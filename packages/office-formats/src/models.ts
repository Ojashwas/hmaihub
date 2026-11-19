/** Document models exchanged between the main process (file I/O) and the editors. */

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export type ParagraphStyle = "Normal" | "Title" | "Heading1" | "Heading2";
export type Alignment = "left" | "center" | "right" | "both";

export interface Paragraph {
  style: ParagraphStyle;
  align?: Alignment;
  rtl?: boolean;
  runs: TextRun[];
}

export interface DocumentModel {
  kind: "document";
  paragraphs: Paragraph[];
}

export interface FormulaErrorValue {
  error: string;
}

export type CellValue = number | string | boolean | FormulaErrorValue | null;

export interface CellModel {
  /** Literal value; ignored when `f` is present. */
  v?: number | string | boolean;
  /** Formula without the leading "=". */
  f?: string;
}

export interface SheetModel {
  name: string;
  cells: Record<string, CellModel>;
}

export interface WorkbookModel {
  kind: "workbook";
  sheets: SheetModel[];
}

export interface SlideModel {
  title: string;
  bullets: string[];
  rtl?: boolean;
}

export interface PresentationModel {
  kind: "presentation";
  slides: SlideModel[];
}

export interface PlanTask {
  uid: number;
  name: string;
  durationDays: number;
  /** Finish-to-start predecessors by UID. */
  predecessors: number[];
}

export interface ProjectModel {
  kind: "project";
  name: string;
  /** ISO date (YYYY-MM-DD) of the first working day. */
  start: string;
  tasks: PlanTask[];
}

export type AnyModel = DocumentModel | WorkbookModel | PresentationModel | ProjectModel;

export interface LoadResult<T extends AnyModel = AnyModel> {
  model: T;
  /** Content present in the file that the preview editors cannot keep. */
  warnings: string[];
}
