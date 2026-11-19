import { computeWorkbook, isError, parseAddress } from "./formula.ts";
import type { CellModel, CellValue, LoadResult, SheetModel, WorkbookModel } from "./models.ts";
import { buildPackage, NS_REL, OpcPackage, relationshipsXml, REL_OFFICE_DOCUMENT } from "./opc.ts";
import { descendants, element, elements, escapeXml, textContent, XML_DECLARATION } from "./xml.ts";

const S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const CT_WORKBOOK = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const CT_WORKBOOK_M = "application/vnd.ms-excel.sheet.macroEnabled.main+xml";
const CT_TEMPLATE = "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml";
const CT_SHEET = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
const CT_STYLES = "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml";
const REL_SHEET = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";
const REL_STYLES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles";
const REL_SST = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings";

const EXCEL_ERRORS = new Set(["#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A"]);
const INVALID_SHEET_NAME = /[[\]:*?/\\]/;

export function readXlsx(bytes: Uint8Array): LoadResult<WorkbookModel> {
  const pkg = new OpcPackage(bytes);
  const main = pkg.mainPart();
  const type = pkg.overrides.get(main.toLowerCase());
  const warnings = new Set<string>();
  if (type === CT_WORKBOOK_M) warnings.add("Macros (VBA) are not kept; the file will be saved as a macro-free .xlsx");
  else if (type !== CT_WORKBOOK && type !== CT_TEMPLATE) throw new Error("This file is not an Excel workbook");

  const rels = pkg.relationships(main);
  const sstRel = rels.find((r) => r.type === REL_SST);
  const shared = sstRel
    ? elements(pkg.xml(sstRel.target), "si").map((si) => descendants(si, "t").map(textContent).join(""))
    : [];

  const wbXml = pkg.xml(main);
  if (element(wbXml, "definedNames")) warnings.add("Named ranges");
  const sheets: SheetModel[] = [];
  for (const s of elements(element(wbXml, "sheets"), "sheet")) {
    const rel = rels.find((r) => r.id === s.attrs["r:id"]);
    if (!rel || rel.type !== REL_SHEET) {
      warnings.add("Chart sheets and other non-worksheet sheets");
      continue;
    }
    const ws = pkg.xml(rel.target);
    for (const [tag, label] of [
      ["mergeCells", "Merged cells"],
      ["conditionalFormatting", "Conditional formatting"],
      ["dataValidations", "Data validation"],
      ["drawing", "Charts, images, and shapes"],
      ["tableParts", "Excel tables"],
      ["hyperlinks", "Hyperlinks"]
    ] as const) {
      if (element(ws, tag)) warnings.add(label);
    }
    const cells: Record<string, CellModel> = {};
    for (const row of elements(element(ws, "sheetData"), "row")) {
      for (const c of elements(row, "c")) {
        const ref = c.attrs["r"];
        if (!ref || !parseAddress(ref)) continue;
        const key = ref.replace(/\$/g, "").toUpperCase();
        const f = element(c, "f");
        const v = textContent(element(c, "v"));
        const t = c.attrs["t"] ?? "n";
        if (f) {
          const formula = textContent(f);
          if (formula) cells[key] = { f: formula };
          else warnings.add("Shared or array formulas (cached values kept)");
          if (formula) continue;
        }
        if (t === "s") cells[key] = { v: shared[Number(v)] ?? "" };
        else if (t === "inlineStr") cells[key] = { v: descendants(c, "t").map(textContent).join("") };
        else if (t === "str") cells[key] = { v };
        else if (t === "b") cells[key] = { v: v === "1" };
        else if (t === "e") cells[key] = { v };
        else if (v !== "") cells[key] = { v: Number(v) };
      }
    }
    sheets.push({ name: s.attrs["name"] ?? `Sheet${sheets.length + 1}`, cells });
  }
  if (pkg.partNames().some((p) => /\/xl\/pivot/i.test(p))) warnings.add("Pivot tables");
  if (pkg.has("/xl/styles.xml")) warnings.add("Cell formatting and number formats");
  if (sheets.length === 0) sheets.push({ name: "Sheet1", cells: {} });
  return { model: { kind: "workbook", sheets }, warnings: [...warnings].sort() };
}

export function validateSheetNames(wb: WorkbookModel): void {
  const seen = new Set<string>();
  for (const s of wb.sheets) {
    if (!s.name || s.name.length > 31 || INVALID_SHEET_NAME.test(s.name))
      throw new Error(`Invalid sheet name "${s.name}"`);
    if (seen.has(s.name.toLowerCase())) throw new Error(`Duplicate sheet name "${s.name}"`);
    seen.add(s.name.toLowerCase());
  }
}

function cellXml(key: string, cell: CellModel, computed: CellValue): string {
  if (cell.f !== undefined) {
    const f = `<f>${escapeXml(cell.f)}</f>`;
    if (computed === null) return `<c r="${key}">${f}</c>`;
    if (typeof computed === "number") return `<c r="${key}">${f}<v>${computed}</v></c>`;
    if (typeof computed === "boolean") return `<c r="${key}" t="b">${f}<v>${computed ? 1 : 0}</v></c>`;
    if (isError(computed))
      return `<c r="${key}" t="e">${f}<v>${EXCEL_ERRORS.has(computed.error) ? computed.error : "#VALUE!"}</v></c>`;
    return `<c r="${key}" t="str">${f}<v>${escapeXml(computed)}</v></c>`;
  }
  const v = cell.v;
  if (v === undefined || v === "") return "";
  if (typeof v === "number") return `<c r="${key}"><v>${v}</v></c>`;
  if (typeof v === "boolean") return `<c r="${key}" t="b"><v>${v ? 1 : 0}</v></c>`;
  return `<c r="${key}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
}

function sheetXml(sheet: SheetModel, values: Map<string, CellValue> | undefined): string {
  const rows = new Map<number, { col: number; xml: string }[]>();
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const a = parseAddress(key);
    if (!a) continue;
    const xml = cellXml(key, cell, values?.get(key) ?? null);
    if (!xml) continue;
    rows.set(a.row, [...(rows.get(a.row) ?? []), { col: a.col, xml }]);
  }
  const data = [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([r, cells]) =>
        `<row r="${r + 1}">${cells
          .sort((x, y) => x.col - y.col)
          .map((c) => c.xml)
          .join("")}</row>`
    )
    .join("");
  return `${XML_DECLARATION}<worksheet xmlns="${S}" xmlns:r="${NS_REL}"><sheetData>${data}</sheetData></worksheet>`;
}

const STYLES_XML = `${XML_DECLARATION}<styleSheet xmlns="${S}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function writeXlsx(wb: WorkbookModel): Uint8Array {
  validateSheetNames(wb);
  const values = computeWorkbook(wb);
  const sheetEntries = wb.sheets
    .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  const workbook = `${XML_DECLARATION}<workbook xmlns="${S}" xmlns:r="${NS_REL}"><sheets>${sheetEntries}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  const wbRels = [
    ...wb.sheets.map((_, i) => ({ id: `rId${i + 1}`, type: REL_SHEET, target: `worksheets/sheet${i + 1}.xml` })),
    { id: `rId${wb.sheets.length + 1}`, type: REL_STYLES, target: "styles.xml" }
  ];
  return buildPackage([
    {
      name: "_rels/.rels",
      data: relationshipsXml([{ id: "rId1", type: REL_OFFICE_DOCUMENT, target: "xl/workbook.xml" }])
    },
    { name: "xl/workbook.xml", contentType: CT_WORKBOOK, data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: relationshipsXml(wbRels) },
    { name: "xl/styles.xml", contentType: CT_STYLES, data: STYLES_XML },
    ...wb.sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      contentType: CT_SHEET,
      data: sheetXml(s, values.get(s.name))
    }))
  ]);
}
