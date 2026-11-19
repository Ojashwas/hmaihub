import {
  addressKey,
  columnName,
  computeWorkbook,
  formatValue,
  isError,
  parseAddress
} from "@hyperoffice/office-formats/formula";
import type { CellValue, WorkbookModel } from "@hyperoffice/office-formats/models";
import { button, el, separator, wireDocumentCommands, type Shell } from "@hyperoffice/app-shell";
import { cellInputText, parseCellInput } from "../cells/cell-input.ts";
import "./hypersheet.css";

const INVALID_NAME = /[[\]:*?/\\]/;

export function mountSheet(shell: Shell): void {
  let wb: WorkbookModel = newModel();
  let active = 0;
  let sel = { col: 0, row: 0 };
  let values = new Map<string, CellValue>();
  let rows = 0;
  let cols = 0;

  const nameBox = el("input", { class: "name-box", readonly: true, "aria-label": "Selected cell" });
  const fx = el("input", {
    class: "fx",
    "aria-label": "Formula bar",
    spellcheck: "false",
    placeholder: "Type a value or =formula"
  });
  const grid = el("div", { class: "grid", tabindex: 0, role: "grid", "aria-label": "Worksheet" });
  const tabs = el("div", { class: "sheet-tabs", role: "tablist" });
  shell.content.append(
    el("div", { class: "formula-row" }, nameBox, el("span", { class: "fx-label", text: "fx" }), fx),
    grid,
    tabs
  );
  const cellInfo = el("span");
  shell.status.append(cellInfo);

  function newModel(): WorkbookModel {
    return { kind: "workbook", sheets: [{ name: "Sheet1", cells: {} }] };
  }
  const sheet = () => wb.sheets[active] as WorkbookModel["sheets"][number];

  const { markDirty } = wireDocumentCommands<WorkbookModel>(shell, {
    newModel,
    getModel: () => wb,
    setModel: (m) => {
      wb = m;
      active = 0;
      sel = { col: 0, row: 0 };
      renderAll();
    }
  });

  shell.toolbar.append(
    button("+ Sheet", "Add sheet", () => {
      let n = wb.sheets.length + 1;
      while (wb.sheets.some((s) => s.name.toLowerCase() === `sheet${n}`)) n++;
      wb.sheets.push({ name: `Sheet${n}`, cells: {} });
      active = wb.sheets.length - 1;
      markDirty();
      renderAll();
    }),
    button("− Sheet", "Delete sheet", () => {
      if (wb.sheets.length === 1 || !confirm(`Delete sheet "${sheet().name}"?`)) return;
      wb.sheets.splice(active, 1);
      active = Math.max(0, active - 1);
      markDirty();
      renderAll();
    }),
    separator(),
    button("Σ", "Insert SUM above", () => {
      if (sel.row === 0) return;
      let top = sel.row - 1;
      while (top > 0 && sheet().cells[addressKey({ col: sel.col, row: top - 1 })]) top--;
      commit(`=SUM(${addressKey({ col: sel.col, row: top })}:${addressKey({ col: sel.col, row: sel.row - 1 })})`);
    })
  );

  function recalc() {
    values = computeWorkbook(wb).get(sheet().name) ?? new Map();
  }

  function size() {
    let maxR = 0;
    let maxC = 0;
    for (const key of Object.keys(sheet().cells)) {
      const a = parseAddress(key);
      if (a) {
        maxR = Math.max(maxR, a.row);
        maxC = Math.max(maxC, a.col);
      }
    }
    return { r: Math.max(100, maxR + 20), c: Math.min(Math.max(26, maxC + 5), 702) };
  }

  function renderGrid() {
    const { r, c } = size();
    rows = r;
    cols = c;
    const table = el("table");
    const head = el("tr", {}, el("th", { class: "corner" }));
    for (let x = 0; x < cols; x++) head.append(el("th", { text: columnName(x), scope: "col" }));
    table.append(el("thead", {}, head));
    const body = el("tbody");
    for (let y = 0; y < rows; y++) {
      const tr = el("tr", {}, el("th", { text: String(y + 1), scope: "row" }));
      for (let x = 0; x < cols; x++)
        tr.append(el("td", { "data-key": addressKey({ col: x, row: y }), role: "gridcell" }));
      body.append(tr);
    }
    table.append(body);
    grid.replaceChildren(table);
    refreshCells();
  }

  function refreshCells() {
    for (const td of grid.querySelectorAll<HTMLTableCellElement>("td")) {
      const key = td.dataset["key"] as string;
      const v = values.get(key) ?? (sheet().cells[key] ? (sheet().cells[key]?.v ?? null) : null);
      td.textContent = formatValue(v);
      td.className = typeof v === "number" ? "num" : isError(v) ? "err" : typeof v === "boolean" ? "bool" : "";
    }
    select(sel);
  }

  function renderTabs() {
    tabs.replaceChildren(
      ...wb.sheets.map((s, i) => {
        const tab = el(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": i === active ? "true" : "false",
            class: i === active ? "active" : ""
          },
          s.name
        );
        tab.addEventListener("click", () => {
          active = i;
          renderAll();
        });
        tab.addEventListener("dblclick", () => renameTab(tab, i));
        return tab;
      })
    );
  }

  function renameTab(tab: HTMLElement, index: number) {
    const input = el("input", { class: "tab-rename", value: wb.sheets[index]?.name ?? "", "aria-label": "Sheet name" });
    tab.replaceWith(input);
    input.select();
    const done = (apply: boolean) => {
      const name = input.value.trim();
      const clash = wb.sheets.some((s, i) => i !== index && s.name.toLowerCase() === name.toLowerCase());
      if (apply && name && name.length <= 31 && !INVALID_NAME.test(name) && !clash) {
        (wb.sheets[index] as WorkbookModel["sheets"][number]).name = name;
        markDirty();
      } else if (apply && name) shell.showError("Sheet names must be unique, 1–31 characters, without [ ] : * ? / \\");
      renderAll();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") done(true);
      if (e.key === "Escape") done(false);
    });
    input.addEventListener("blur", () => done(true), { once: true });
  }

  function select(addr: { col: number; row: number }) {
    sel = { col: Math.max(0, Math.min(cols - 1, addr.col)), row: Math.max(0, Math.min(rows - 1, addr.row)) };
    const key = addressKey(sel);
    grid.querySelector("td.selected")?.classList.remove("selected");
    const td = grid.querySelector<HTMLTableCellElement>(`td[data-key="${key}"]`);
    td?.classList.add("selected");
    td?.scrollIntoView({ block: "nearest", inline: "nearest" });
    nameBox.value = key;
    fx.value = cellInputText(sheet().cells[key]);
    const v = values.get(key);
    cellInfo.textContent = `${sheet().name}!${key}${v !== undefined && v !== null ? ` = ${formatValue(v)}` : ""}`;
  }

  function commit(text: string) {
    const key = addressKey(sel);
    const cell = parseCellInput(text);
    if (cell) sheet().cells[key] = cell;
    else sheet().cells = Object.fromEntries(Object.entries(sheet().cells).filter(([k]) => k !== key));
    markDirty();
    recalc();
    const before = { rows, cols };
    const { r, c } = size();
    if (r !== before.rows || c !== before.cols) renderGrid();
    else refreshCells();
  }

  function renderAll() {
    recalc();
    renderTabs();
    renderGrid();
  }

  grid.addEventListener("click", (e) => {
    const td = (e.target as HTMLElement).closest("td");
    const a = td ? parseAddress(td.dataset["key"] ?? "") : null;
    if (a) select(a);
  });
  grid.addEventListener("dblclick", () => fx.focus());
  grid.addEventListener("keydown", (e) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      Tab: [1, 0]
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      select({ col: sel.col + m[0], row: sel.row + m[1] });
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      fx.focus();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      commit("");
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      fx.value = e.key;
      fx.focus();
    }
  });
  fx.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      commit(fx.value);
      select(e.key === "Enter" ? { col: sel.col, row: sel.row + 1 } : { col: sel.col + 1, row: sel.row });
      grid.focus();
    } else if (e.key === "Escape") {
      fx.value = cellInputText(sheet().cells[addressKey(sel)]);
      grid.focus();
    }
  });

  renderAll();
  grid.focus();
}
