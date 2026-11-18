import { DESKTOP_LIMITS, PackageSecurityError, type PackageLimits } from "./limits.ts";
import { readCentralDirectory, readEntry, type ZipEntry } from "./zip.ts";

export type DetectedFormat =
  | "docx"
  | "docm"
  | "dotx"
  | "dotm"
  | "xlsx"
  | "xlsm"
  | "xltx"
  | "xltm"
  | "pptx"
  | "pptm"
  | "potx"
  | "potm"
  | "ppsx"
  | "ppsm"
  | "mspdi"
  | "ole-compound"
  | "opc-unknown"
  | "zip"
  | "pdf"
  | "rtf"
  | "unknown";

export type DetectionWarning =
  | "MACROS_PRESENT"
  | "ENCRYPTED_ENTRIES"
  | "EXTENSION_MISMATCH"
  | "AMBIGUOUS_MAIN_PART"
  | "LEGACY_OR_ENCRYPTED_CONTAINER";

export interface DetectionResult {
  format: DetectedFormat;
  /** Compatibility level of this result. Detection only, so at most L0. */
  level: "L0";
  mediaType?: string;
  evidence: string[];
  warnings: DetectionWarning[];
  parts?: string[];
}

const MAIN_PART_TYPES: Record<
  string,
  Exclude<DetectedFormat, "mspdi" | "ole-compound" | "opc-unknown" | "zip" | "pdf" | "rtf" | "unknown">
> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": "docx",
  "application/vnd.ms-word.document.macroEnabled.main+xml": "docm",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": "dotx",
  "application/vnd.ms-word.template.macroEnabledTemplate.main+xml": "dotm",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": "xlsx",
  "application/vnd.ms-excel.sheet.macroEnabled.main+xml": "xlsm",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": "xltx",
  "application/vnd.ms-excel.template.macroEnabled.main+xml": "xltm",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": "pptx",
  "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml": "pptm",
  "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": "potx",
  "application/vnd.ms-powerpoint.template.macroEnabled.main+xml": "potm",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": "ppsx",
  "application/vnd.ms-powerpoint.slideshow.macroEnabled.main+xml": "ppsm"
};

export const FILE_MEDIA_TYPES: Partial<Record<DetectedFormat, string>> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  docm: "application/vnd.ms-word.document.macroEnabled.12",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  dotm: "application/vnd.ms-word.template.macroEnabled.12",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xltx: "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  xltm: "application/vnd.ms-excel.template.macroEnabled.12",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pptm: "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
  potx: "application/vnd.openxmlformats-officedocument.presentationml.template",
  potm: "application/vnd.ms-powerpoint.template.macroEnabled.12",
  ppsx: "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  ppsm: "application/vnd.ms-powerpoint.slideshow.macroEnabled.12",
  mspdi: "application/xml",
  pdf: "application/pdf",
  rtf: "application/rtf",
  zip: "application/zip"
};

const OFFICE_DOCUMENT_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const MSPDI_NAMESPACE = "http://schemas.microsoft.com/project";
const XML_SNIFF_BYTES = 64 * 1024;

const startsWith = (bytes: Uint8Array, sig: readonly number[]) => sig.every((b, i) => bytes[i] === b);
const latin1 = new TextDecoder("latin1");
const utf8 = new TextDecoder("utf-8");

/** Detection-only XML reading: DTDs are refused outright so entity expansion and XXE cannot occur. */
function xmlText(bytes: Uint8Array): string {
  const text = utf8.decode(bytes).replace(/^\uFEFF/, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new PackageSecurityError("DTD_NOT_ALLOWED", "XML document type declarations are not allowed");
  return text;
}

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    out[m[1] as string] = m[3] ?? m[4] ?? "";
  }
  return out;
}

function resolveTarget(target: string): string {
  const segments: string[] = [];
  for (const seg of target.replace(/^\//, "").split("/")) {
    if (seg === "..") segments.pop();
    else if (seg !== "." && seg !== "") segments.push(seg);
  }
  return `/${segments.join("/")}`;
}

function detectOpc(bytes: Uint8Array, entries: ZipEntry[], limits: PackageLimits): DetectionResult {
  const byName = new Map(entries.map((e) => [e.name.toLowerCase(), e]));
  const parts = entries.map((e) => e.name);
  const warnings: DetectionWarning[] = [];
  if (entries.some((e) => e.encrypted)) warnings.push("ENCRYPTED_ENTRIES");
  if (entries.some((e) => /(^|\/)vbaProject\.bin$/i.test(e.name))) warnings.push("MACROS_PRESENT");

  const ct = byName.get("[content_types].xml");
  if (!ct)
    return {
      format: "zip",
      level: "L0",
      mediaType: "application/zip",
      evidence: ["ZIP without [Content_Types].xml"],
      warnings,
      parts
    };

  const overrides = new Map<string, string>();
  for (const m of xmlText(readEntry(bytes, ct, limits)).matchAll(/<Override\b[^>]*>/g)) {
    const a = attributes(m[0]);
    if (a["PartName"] && a["ContentType"]) overrides.set(a["PartName"].toLowerCase(), a["ContentType"]);
  }

  const evidence = ["[Content_Types].xml present"];
  let mainPart: string | undefined;
  const rels = byName.get("_rels/.rels");
  if (rels) {
    for (const m of xmlText(readEntry(bytes, rels, limits)).matchAll(/<Relationship\b[^>]*>/g)) {
      const a = attributes(m[0]);
      if (a["Type"] === OFFICE_DOCUMENT_REL && a["Target"] && a["TargetMode"] !== "External") {
        mainPart = resolveTarget(a["Target"]);
        evidence.push(`officeDocument relationship -> ${mainPart}`);
      }
    }
  }

  let format: DetectedFormat | undefined;
  const mainType = mainPart ? overrides.get(mainPart.toLowerCase()) : undefined;
  if (mainType && MAIN_PART_TYPES[mainType]) {
    format = MAIN_PART_TYPES[mainType];
    evidence.push(`main part content type ${mainType}`);
  } else {
    const candidates = [...overrides.values()].filter((t) => MAIN_PART_TYPES[t]);
    if (candidates.length > 1) warnings.push("AMBIGUOUS_MAIN_PART");
    if (candidates[0]) {
      format = MAIN_PART_TYPES[candidates[0]];
      evidence.push(`fallback: override content type ${candidates[0]}`);
    }
  }
  if (!format) return { format: "opc-unknown", level: "L0", evidence, warnings, parts };
  const mediaType = FILE_MEDIA_TYPES[format];
  return { format, level: "L0", ...(mediaType ? { mediaType } : {}), evidence, warnings, parts };
}

function detectXml(bytes: Uint8Array): DetectionResult | undefined {
  const text = utf8
    .decode(bytes.subarray(0, XML_SNIFF_BYTES))
    .replace(/^\uFEFF/, "")
    .trimStart();
  if (!text.startsWith("<")) return undefined;
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    return {
      format: "unknown",
      level: "L0",
      evidence: ["markup with a document type declaration; not inspected"],
      warnings: []
    };
  }
  const root = /<(?!\?|!--)([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)\b[^>]*>/.exec(text);
  if (
    root &&
    root[2] === "Project" &&
    attributes(root[0])[root[1] ? `xmlns:${root[1].slice(0, -1)}` : "xmlns"] === MSPDI_NAMESPACE
  ) {
    return {
      format: "mspdi",
      level: "L0",
      mediaType: "application/xml",
      evidence: [`root <Project> in ${MSPDI_NAMESPACE}`],
      warnings: []
    };
  }
  return undefined;
}

const EXTENSIONS: Partial<Record<DetectedFormat, string>> = {
  mspdi: "xml",
  "ole-compound": "doc|xls|ppt|mpp|mpt|docx|xlsx|pptx"
};

/**
 * Detects the container and Office format from content, never from the file
 * name. When a name is given, a mismatching extension is reported.
 */
export function detectFormat(
  bytes: Uint8Array,
  options: { fileName?: string; limits?: PackageLimits } = {}
): DetectionResult {
  const limits = options.limits ?? DESKTOP_LIMITS;
  let result: DetectionResult;
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    result = detectOpc(bytes, readCentralDirectory(bytes, limits), limits);
  } else if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    result = {
      format: "ole-compound",
      level: "L0",
      evidence: ["OLE Compound File signature"],
      warnings: ["LEGACY_OR_ENCRYPTED_CONTAINER"]
    };
  } else if (latin1.decode(bytes.subarray(0, 5)) === "%PDF-") {
    result = { format: "pdf", level: "L0", mediaType: "application/pdf", evidence: ["%PDF- signature"], warnings: [] };
  } else if (latin1.decode(bytes.subarray(0, 5)) === "{\\rtf") {
    result = { format: "rtf", level: "L0", mediaType: "application/rtf", evidence: ["{\\rtf signature"], warnings: [] };
  } else {
    result = detectXml(bytes) ?? { format: "unknown", level: "L0", evidence: [], warnings: [] };
  }

  if (options.fileName && result.format !== "unknown") {
    const ext = options.fileName.toLowerCase().split(".").pop() ?? "";
    const allowed = (EXTENSIONS[result.format] ?? result.format).split("|");
    if (!allowed.includes(ext)) result.warnings.push("EXTENSION_MISMATCH");
  }
  return result;
}
