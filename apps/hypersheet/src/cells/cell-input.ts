import { parseLiteral } from "@hyperoffice/office-formats/formula";
import type { CellModel } from "@hyperoffice/office-formats/models";

/** Converts formula-bar input to a cell; `undefined` means the cell is cleared. */
export function parseCellInput(text: string): CellModel | undefined {
  if (text === "") return undefined;
  if (text.startsWith("=") && text.length > 1) return { f: text.slice(1) };
  return { v: parseLiteral(text) };
}

/** Text shown in the formula bar for a cell. */
export function cellInputText(cell: CellModel | undefined): string {
  if (!cell) return "";
  if (cell.f !== undefined) return `=${cell.f}`;
  if (typeof cell.v === "boolean") return cell.v ? "TRUE" : "FALSE";
  return cell.v === undefined ? "" : String(cell.v);
}
