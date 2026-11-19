import type { Alignment, DocumentModel, LoadResult, Paragraph, ParagraphStyle, TextRun } from "./models.ts";
import { buildPackage, NS_REL, OpcPackage, relationshipsXml, REL_OFFICE_DOCUMENT } from "./opc.ts";
import { element, elements, escapeXml, XML_DECLARATION, type XmlElement } from "./xml.ts";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const CT_DOC = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
const CT_DOCM = "application/vnd.ms-word.document.macroEnabled.main+xml";
const CT_STYLES = "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml";
const REL_STYLES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles";

const STYLE_MAP: Record<string, ParagraphStyle> = {
  title: "Title",
  heading1: "Heading1",
  heading2: "Heading2",
  "1": "Heading1",
  "2": "Heading2"
};
const ALIGN_MAP: Record<string, Alignment> = {
  left: "left",
  start: "left",
  center: "center",
  right: "right",
  end: "right",
  both: "both",
  distribute: "both"
};

const on = (el: XmlElement | undefined): boolean =>
  el !== undefined && !["0", "false", "off", "none"].includes(el.attrs["w:val"] ?? "true");

const UNSUPPORTED: Record<string, string> = {
  "w:drawing": "Images and drawings",
  "w:pict": "Legacy images",
  "w:object": "Embedded objects",
  "w:footnoteReference": "Footnotes",
  "w:endnoteReference": "Endnotes",
  "w:commentReference": "Comments",
  "w:ins": "Tracked insertions (kept as plain text)",
  "w:del": "Tracked deletions",
  "w:fldSimple": "Fields",
  "w:fldChar": "Fields",
  "w:sdt": "Content controls (text kept)",
  "w:numPr": "Numbered and bulleted lists (text kept)"
};

export function readDocx(bytes: Uint8Array): LoadResult<DocumentModel> {
  const pkg = new OpcPackage(bytes);
  const main = pkg.mainPart();
  const type = pkg.overrides.get(main.toLowerCase());
  const warnings = new Set<string>();
  if (type === CT_DOCM) warnings.add("Macros (VBA) are not kept; the file will be saved as a macro-free .docx");
  else if (
    type !== CT_DOC &&
    type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml"
  ) {
    throw new Error("This file is not a Word document");
  }
  const doc = pkg.xml(main);
  const body = element(doc, "w:body");
  const paragraphs: Paragraph[] = [];

  const visitBlock = (el: XmlElement) => {
    if (el.name === "w:p") paragraphs.push(readParagraph(el, warnings));
    else if (el.name === "w:tbl") {
      warnings.add("Tables (cell text kept as paragraphs)");
      for (const p of descendantsOf(el, "w:p")) paragraphs.push(readParagraph(p, warnings));
    } else if (el.name === "w:sdt") {
      warnings.add(UNSUPPORTED["w:sdt"] as string);
      for (const c of elements(element(el, "w:sdtContent"))) visitBlock(c);
    }
  };
  for (const el of elements(body)) visitBlock(el);

  const hasHeaders = pkg.partNames().some((p) => /\/word\/(header|footer)\d*\.xml$/i.test(p));
  if (hasHeaders) warnings.add("Headers and footers");
  if (pkg.has("/word/numbering.xml")) warnings.add(UNSUPPORTED["w:numPr"] as string);
  if (paragraphs.length === 0) paragraphs.push({ style: "Normal", runs: [{ text: "" }] });
  return { model: { kind: "document", paragraphs }, warnings: [...warnings].sort() };
}

function descendantsOf(el: XmlElement, name: string): XmlElement[] {
  const out: XmlElement[] = [];
  for (const c of elements(el)) {
    if (c.name === name) out.push(c);
    else out.push(...descendantsOf(c, name));
  }
  return out;
}

function readParagraph(p: XmlElement, warnings: Set<string>): Paragraph {
  const pPr = element(p, "w:pPr");
  const styleId = (element(pPr, "w:pStyle")?.attrs["w:val"] ?? "").toLowerCase();
  const outline = element(pPr, "w:outlineLvl")?.attrs["w:val"];
  const style = STYLE_MAP[styleId] ?? (outline === "0" ? "Heading1" : outline === "1" ? "Heading2" : "Normal");
  const para: Paragraph = { style, runs: [] };
  const jc = ALIGN_MAP[element(pPr, "w:jc")?.attrs["w:val"] ?? ""];
  if (jc && jc !== "left") para.align = jc;
  if (on(element(pPr, "w:bidi"))) para.rtl = true;
  if (element(pPr, "w:numPr")) warnings.add(UNSUPPORTED["w:numPr"] as string);

  const visit = (el: XmlElement) => {
    for (const c of elements(el)) {
      const reason = UNSUPPORTED[c.name];
      if (reason && c.name !== "w:numPr") warnings.add(reason);
      if (c.name === "w:r") para.runs.push(...readRun(c, warnings));
      else if (
        ["w:hyperlink", "w:ins", "w:smartTag", "w:customXml", "w:sdt", "w:sdtContent", "w:fldSimple"].includes(c.name)
      )
        visit(c);
    }
  };
  visit(p);
  return para;
}

function readRun(r: XmlElement, warnings: Set<string>): TextRun[] {
  const rPr = element(r, "w:rPr");
  const fmt: Omit<TextRun, "text"> = {};
  if (on(element(rPr, "w:b"))) fmt.bold = true;
  if (on(element(rPr, "w:i"))) fmt.italic = true;
  if (on(element(rPr, "w:u"))) fmt.underline = true;
  let text = "";
  for (const c of elements(r)) {
    if (c.name === "w:t") text += c.children.filter((x): x is string => typeof x === "string").join("");
    else if (c.name === "w:tab") text += "\t";
    else if (c.name === "w:br" || c.name === "w:cr") text += "\n";
    else if (UNSUPPORTED[c.name]) warnings.add(UNSUPPORTED[c.name] as string);
  }
  return text ? [{ text, ...fmt }] : [];
}

function runXml(run: TextRun, rtl: boolean): string {
  const props = `${run.bold ? "<w:b/>" : ""}${run.italic ? "<w:i/>" : ""}${run.underline ? '<w:u w:val="single"/>' : ""}${rtl ? "<w:rtl/>" : ""}`;
  const rPr = props ? `<w:rPr>${props}</w:rPr>` : "";
  const content = run.text
    .split(/(\t|\n)/)
    .map((piece) =>
      piece === "\t"
        ? "<w:tab/>"
        : piece === "\n"
          ? "<w:br/>"
          : piece
            ? `<w:t xml:space="preserve">${escapeXml(piece)}</w:t>`
            : ""
    )
    .join("");
  return `<w:r>${rPr}${content}</w:r>`;
}

function paragraphXml(p: Paragraph): string {
  const props = `${p.style !== "Normal" ? `<w:pStyle w:val="${p.style}"/>` : ""}${p.rtl ? "<w:bidi/>" : ""}${p.align && p.align !== "left" ? `<w:jc w:val="${p.align}"/>` : ""}`;
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${p.runs.map((r) => runXml(r, p.rtl === true)).join("")}</w:p>`;
}

const STYLES_XML = `${XML_DECLARATION}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style></w:styles>`;

export function writeDocx(model: DocumentModel): Uint8Array {
  const body = model.paragraphs.map(paragraphXml).join("");
  const sect =
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';
  const document = `${XML_DECLARATION}<w:document xmlns:w="${W}" xmlns:r="${NS_REL}"><w:body>${body}${sect}</w:body></w:document>`;
  return buildPackage([
    {
      name: "_rels/.rels",
      data: relationshipsXml([{ id: "rId1", type: REL_OFFICE_DOCUMENT, target: "word/document.xml" }])
    },
    { name: "word/document.xml", contentType: CT_DOC, data: document },
    {
      name: "word/_rels/document.xml.rels",
      data: relationshipsXml([{ id: "rId1", type: REL_STYLES, target: "styles.xml" }])
    },
    { name: "word/styles.xml", contentType: CT_STYLES, data: STYLES_XML }
  ]);
}
