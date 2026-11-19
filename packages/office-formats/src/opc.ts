import {
  DESKTOP_LIMITS,
  readCentralDirectory,
  readEntry,
  writeZip,
  type ZipEntry,
  type ZipInput
} from "@hyperoffice/format-detector";
import { elements, parseXml, XML_DECLARATION, type XmlElement } from "./xml.ts";

const LIMITS = { ...DESKTOP_LIMITS, maxInspectedPartBytes: DESKTOP_LIMITS.maxEntryUncompressed };
const utf8 = new TextDecoder("utf-8");

export const REL_OFFICE_DOCUMENT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
export const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types";

export interface Relationship {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

/** Read-only view of an OPC package with bounded extraction. */
export class OpcPackage {
  readonly #bytes: Uint8Array;
  readonly #entries = new Map<string, ZipEntry>();
  readonly overrides = new Map<string, string>();

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
    for (const e of readCentralDirectory(bytes, LIMITS)) this.#entries.set(e.name.toLowerCase(), e);
    const ct = this.xml("/[Content_Types].xml");
    if (!ct) throw new Error("Not an Office Open XML package: [Content_Types].xml is missing");
    for (const o of elements(ct, "Override")) {
      if (o.attrs["PartName"] && o.attrs["ContentType"])
        this.overrides.set(o.attrs["PartName"].toLowerCase(), o.attrs["ContentType"]);
    }
  }

  partNames(): string[] {
    return [...this.#entries.values()].map((e) => `/${e.name}`);
  }

  has(part: string): boolean {
    return this.#entries.has(part.replace(/^\//, "").toLowerCase());
  }

  text(part: string): string | undefined {
    const e = this.#entries.get(part.replace(/^\//, "").toLowerCase());
    return e ? utf8.decode(readEntry(this.#bytes, e, LIMITS)) : undefined;
  }

  xml(part: string): XmlElement | undefined {
    const t = this.text(part);
    return t === undefined ? undefined : parseXml(t);
  }

  relationships(part: string): Relationship[] {
    const slash = part.lastIndexOf("/");
    const relsPart = `${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`;
    const rels = this.xml(relsPart);
    return elements(rels, "Relationship").map((r) => {
      const external = r.attrs["TargetMode"] === "External";
      return {
        id: r.attrs["Id"] ?? "",
        type: r.attrs["Type"] ?? "",
        external,
        target: external ? (r.attrs["Target"] ?? "") : resolvePart(part, r.attrs["Target"] ?? "")
      };
    });
  }

  mainPart(): string {
    const rel = this.relationships("/").find((r) => r.type === REL_OFFICE_DOCUMENT && !r.external);
    if (!rel) throw new Error("The package has no main document");
    return rel.target;
  }
}

/** Resolves a relationship target relative to its source part. */
export function resolvePart(sourcePart: string, target: string): string {
  const base = target.startsWith("/") ? [] : sourcePart.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") base.pop();
    else if (seg !== "." && seg !== "") base.push(seg);
  }
  return `/${base.filter((s) => s !== "").join("/")}`;
}

export interface PartSpec {
  name: string;
  contentType?: string;
  data: string | Uint8Array;
}

export interface RelSpec {
  id: string;
  type: string;
  target: string;
}

export function relationshipsXml(rels: RelSpec[]): string {
  return `${XML_DECLARATION}<Relationships xmlns="${NS_PKG_REL}">${rels
    .map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
    .join("")}</Relationships>`;
}

/** Writes an OPC package: content types are generated from the part list. */
export function buildPackage(parts: PartSpec[]): Uint8Array {
  const overrides = parts
    .filter((p) => p.contentType)
    .map((p) => `<Override PartName="/${p.name}" ContentType="${p.contentType}"/>`)
    .join("");
  const ct = `${XML_DECLARATION}<Types xmlns="${NS_CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides}</Types>`;
  const inputs: ZipInput[] = [
    { name: "[Content_Types].xml", data: ct, deflate: true },
    ...parts.map((p) => ({ name: p.name, data: p.data, deflate: true }))
  ];
  return writeZip(inputs);
}
