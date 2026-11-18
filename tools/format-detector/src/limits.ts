const MiB = 1024 * 1024;

export interface PackageLimits {
  maxEntries: number;
  maxTotalUncompressed: number;
  maxEntryUncompressed: number;
  maxCompressionRatio: number;
  maxNameLength: number;
  /** Upper bound on bytes inflated for any part inspected during detection. */
  maxInspectedPartBytes: number;
}

/** Initial defensive defaults; see docs/security/file-processing.md. Adjust only with benchmark evidence. */
export const DESKTOP_LIMITS: PackageLimits = {
  maxEntries: 50_000,
  maxTotalUncompressed: 1024 * MiB,
  maxEntryUncompressed: 100 * MiB,
  maxCompressionRatio: 200,
  maxNameLength: 1024,
  maxInspectedPartBytes: 4 * MiB
};

export const SERVER_LIMITS: PackageLimits = { ...DESKTOP_LIMITS, maxTotalUncompressed: 250 * MiB };

export type PackageErrorCode =
  | "NOT_A_ZIP"
  | "TRUNCATED"
  | "ZIP64_UNSUPPORTED"
  | "MULTI_DISK_UNSUPPORTED"
  | "TOO_MANY_ENTRIES"
  | "ENTRY_TOO_LARGE"
  | "PACKAGE_TOO_LARGE"
  | "ZIP_BOMB_SUSPECTED"
  | "PATH_TRAVERSAL"
  | "DUPLICATE_ENTRY"
  | "UNSUPPORTED_COMPRESSION"
  | "SIZE_MISMATCH"
  | "DTD_NOT_ALLOWED";

export class PackageSecurityError extends Error {
  readonly code: PackageErrorCode;

  constructor(code: PackageErrorCode, message: string) {
    super(message);
    this.name = "PackageSecurityError";
    this.code = code;
  }
}
