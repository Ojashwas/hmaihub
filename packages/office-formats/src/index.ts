import { detectFormat } from "@hyperoffice/format-detector";
import { readDocx, writeDocx } from "./docx.ts";
import type { AnyModel, LoadResult } from "./models.ts";
import { readMspdi, writeMspdi } from "./mspdi.ts";
import { readPptx, writePptx } from "./pptx.ts";
import { readXlsx, writeXlsx } from "./xlsx.ts";

export * from "./models.ts";
export { readDocx, writeDocx } from "./docx.ts";
export { readXlsx, writeXlsx, validateSheetNames } from "./xlsx.ts";
export { readPptx, writePptx } from "./pptx.ts";
export { readMspdi, writeMspdi } from "./mspdi.ts";
export { parseXml, XmlError } from "./xml.ts";

export type ModelKind = AnyModel["kind"];

export const FILE_EXTENSIONS: Record<ModelKind, { open: string[]; save: string }> = {
  document: { open: ["docx", "docm", "dotx"], save: "docx" },
  workbook: { open: ["xlsx", "xlsm", "xltx"], save: "xlsx" },
  presentation: { open: ["pptx", "pptm", "potx", "ppsx"], save: "pptx" },
  project: { open: ["xml"], save: "xml" }
};

const FORMAT_KIND: Record<string, ModelKind> = {
  docx: "document",
  docm: "document",
  dotx: "document",
  xlsx: "workbook",
  xlsm: "workbook",
  xltx: "workbook",
  pptx: "presentation",
  pptm: "presentation",
  potx: "presentation",
  ppsx: "presentation",
  mspdi: "project"
};

/** Detects the format from content (never the extension) and loads it for the expected editor. */
export function loadFile(bytes: Uint8Array, expected: ModelKind, fileName?: string): LoadResult {
  const detection = detectFormat(bytes, fileName === undefined ? {} : { fileName });
  const kind = FORMAT_KIND[detection.format];
  if (!kind) throw new Error(`Unsupported or unrecognised file (${detection.format})`);
  if (kind !== expected) throw new Error(`This is a ${kind} file; open it with the matching HyperOffice app`);
  const result =
    kind === "document"
      ? readDocx(bytes)
      : kind === "workbook"
        ? readXlsx(bytes)
        : kind === "presentation"
          ? readPptx(bytes)
          : readMspdi(new TextDecoder("utf-8").decode(bytes));
  if (detection.warnings.includes("EXTENSION_MISMATCH"))
    result.warnings.unshift("The file extension does not match its content");
  return result;
}

export function saveFile(model: AnyModel): Uint8Array {
  switch (model.kind) {
    case "document":
      return writeDocx(model);
    case "workbook":
      return writeXlsx(model);
    case "presentation":
      return writePptx(model);
    case "project":
      return new TextEncoder().encode(writeMspdi(model));
  }
}
