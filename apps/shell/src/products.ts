import type { ModelKind } from "@hyperoffice/office-formats";

export type ProductId = "suite" | "hyperdoc" | "hypersheet" | "hyperdeck" | "hyperplan";
export type EditorId = Exclude<ProductId, "suite">;

export interface ProductInfo {
  id: ProductId;
  name: string;
  appId: string;
  description: string;
  /** Icon/background colour as [r, g, b]. */
  color: [number, number, number];
  kind?: ModelKind;
  fileTypeName?: string;
  openExtensions: string[];
  saveExtension?: string;
}

export const PRODUCTS: Record<ProductId, ProductInfo> = {
  suite: {
    id: "suite",
    name: "HyperOffice",
    appId: "com.hyperoffice.suite",
    description: "HyperOffice suite: documents, spreadsheets, presentations, and project plans",
    color: [30, 41, 59],
    openExtensions: ["docx", "xlsx", "pptx", "xml"]
  },
  hyperdoc: {
    id: "hyperdoc",
    name: "HyperDoc",
    appId: "com.hyperoffice.hyperdoc",
    description: "Word processor for .docx documents",
    color: [37, 99, 235],
    kind: "document",
    fileTypeName: "Word document",
    openExtensions: ["docx", "docm", "dotx"],
    saveExtension: "docx"
  },
  hypersheet: {
    id: "hypersheet",
    name: "HyperSheet",
    appId: "com.hyperoffice.hypersheet",
    description: "Spreadsheet for .xlsx workbooks",
    color: [22, 163, 74],
    kind: "workbook",
    fileTypeName: "Excel workbook",
    openExtensions: ["xlsx", "xlsm", "xltx"],
    saveExtension: "xlsx"
  },
  hyperdeck: {
    id: "hyperdeck",
    name: "HyperDeck",
    appId: "com.hyperoffice.hyperdeck",
    description: "Presentations for .pptx decks",
    color: [234, 88, 12],
    kind: "presentation",
    fileTypeName: "PowerPoint presentation",
    openExtensions: ["pptx", "pptm", "potx", "ppsx"],
    saveExtension: "pptx"
  },
  hyperplan: {
    id: "hyperplan",
    name: "HyperPlan",
    appId: "com.hyperoffice.hyperplan",
    description: "Project scheduling for Microsoft Project XML plans",
    color: [124, 58, 237],
    kind: "project",
    fileTypeName: "Project XML plan",
    openExtensions: ["xml"],
    saveExtension: "xml"
  }
};

export const EDITORS: EditorId[] = ["hyperdoc", "hypersheet", "hyperdeck", "hyperplan"];

export const isProductId = (v: unknown): v is ProductId => typeof v === "string" && Object.hasOwn(PRODUCTS, v);

export function editorForExtension(ext: string): EditorId | undefined {
  const e = ext.toLowerCase().replace(/^\./, "");
  return EDITORS.find((id) => PRODUCTS[id].openExtensions.includes(e));
}
