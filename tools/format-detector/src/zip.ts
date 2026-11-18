import { inflateRawSync } from "node:zlib";
import { PackageSecurityError, type PackageLimits } from "./limits.ts";

export interface ZipEntry {
  name: string;
  method: number;
  flags: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  encrypted: boolean;
}

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

const fail = (code: ConstructorParameters<typeof PackageSecurityError>[0], message: string): never => {
  throw new PackageSecurityError(code, message);
};

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function findEndOfCentralDirectory(dv: DataView): number {
  const min = Math.max(0, dv.byteLength - 22 - 0xffff);
  for (let i = dv.byteLength - 22; i >= min; i--) {
    if (dv.getUint32(i, true) === EOCD_SIG) return i;
  }
  return fail("NOT_A_ZIP", "End of central directory not found");
}

function validateName(name: string, maxLength: number): void {
  if (name.length === 0 || name.length > maxLength) fail("PATH_TRAVERSAL", "Invalid entry name length");
  if (name.includes("\\") || name.includes("\0") || name.startsWith("/") || /^[A-Za-z]:/.test(name)) {
    fail("PATH_TRAVERSAL", `Unsafe entry name: ${JSON.stringify(name.slice(0, 80))}`);
  }
  if (name.split("/").some((seg) => seg === ".." || seg === ".")) {
    fail("PATH_TRAVERSAL", `Relative path segment in entry: ${JSON.stringify(name.slice(0, 80))}`);
  }
}

/** Reads only the central directory and enforces package limits before any decompression. */
export function readCentralDirectory(bytes: Uint8Array, limits: PackageLimits): ZipEntry[] {
  const dv = view(bytes);
  if (dv.byteLength < 22) fail("NOT_A_ZIP", "Too small to be a ZIP package");
  const eocd = findEndOfCentralDirectory(dv);
  if (dv.getUint16(eocd + 4, true) !== 0 || dv.getUint16(eocd + 6, true) !== 0) {
    fail("MULTI_DISK_UNSUPPORTED", "Multi-disk archives are not supported");
  }
  const total = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    fail("ZIP64_UNSUPPORTED", "ZIP64 packages are not supported at L0");
  }
  if (total > limits.maxEntries) fail("TOO_MANY_ENTRIES", `${total} entries exceeds ${limits.maxEntries}`);
  if (cdOffset + cdSize > eocd) fail("TRUNCATED", "Central directory lies outside the file");

  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let totalUncompressed = 0;
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (p + 46 > eocd || dv.getUint32(p, true) !== CDH_SIG) fail("TRUNCATED", "Corrupt central directory header");
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const compressedSize = dv.getUint32(p + 20, true);
    const uncompressedSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localHeaderOffset = dv.getUint32(p + 42, true);
    if (p + 46 + nameLen > eocd) fail("TRUNCATED", "Entry name exceeds central directory");
    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
    const name = new TextDecoder(flags & 0x0800 ? "utf-8" : "latin1").decode(nameBytes);
    validateName(name, limits.maxNameLength);

    // OPC part names compare case-insensitively (ECMA-376 Part 2).
    const key = name.toLowerCase();
    if (seen.has(key)) fail("DUPLICATE_ENTRY", `Duplicate entry ${JSON.stringify(name)}`);
    seen.add(key);

    if (uncompressedSize > limits.maxEntryUncompressed)
      fail("ENTRY_TOO_LARGE", `${name} exceeds the single-part limit`);
    if (uncompressedSize / Math.max(compressedSize, 1) > limits.maxCompressionRatio && uncompressedSize > 1024 * 1024) {
      fail("ZIP_BOMB_SUSPECTED", `${name} has a compression ratio above ${limits.maxCompressionRatio}`);
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.maxTotalUncompressed)
      fail("PACKAGE_TOO_LARGE", "Total uncompressed size exceeds limit");
    if (localHeaderOffset >= cdOffset) fail("TRUNCATED", "Local header offset outside data area");

    entries.push({
      name,
      method,
      flags,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      encrypted: (flags & 1) === 1
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Extracts one entry with a hard output cap; never trusts declared sizes alone. */
export function readEntry(bytes: Uint8Array, entry: ZipEntry, limits: PackageLimits): Uint8Array {
  const dv = view(bytes);
  const o = entry.localHeaderOffset;
  if (o + 30 > dv.byteLength || dv.getUint32(o, true) !== LFH_SIG)
    fail("TRUNCATED", `Bad local header for ${entry.name}`);
  const start = o + 30 + dv.getUint16(o + 26, true) + dv.getUint16(o + 28, true);
  const end = start + entry.compressedSize;
  if (end > dv.byteLength) fail("TRUNCATED", `${entry.name} data exceeds file`);
  const raw = bytes.subarray(start, end);
  if (entry.uncompressedSize > limits.maxInspectedPartBytes)
    fail("ENTRY_TOO_LARGE", `${entry.name} is too large to inspect`);
  const cap = entry.uncompressedSize;
  let out: Uint8Array;
  if (entry.method === 0) {
    out = raw;
  } else if (entry.method === 8) {
    try {
      out = inflateRawSync(raw, { maxOutputLength: cap + 1 });
    } catch {
      return fail("ZIP_BOMB_SUSPECTED", `${entry.name} inflated beyond its declared size or is corrupt`);
    }
  } else {
    return fail("UNSUPPORTED_COMPRESSION", `${entry.name} uses compression method ${entry.method}`);
  }
  if (out.length !== entry.uncompressedSize) fail("SIZE_MISMATCH", `${entry.name} size does not match its declaration`);
  return out;
}
