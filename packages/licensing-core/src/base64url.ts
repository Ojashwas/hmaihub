import { LicenseTokenError } from "./errors.ts";

const BASE64URL_ALPHABET = /^[A-Za-z0-9_-]*$/;

export function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/** Decodes unpadded base64url and rejects non-canonical encodings. */
export function decodeBase64UrlStrict(value: string): Uint8Array {
  if (!BASE64URL_ALPHABET.test(value) || value.length % 4 === 1) {
    throw new LicenseTokenError("INVALID_BASE64URL", "Invalid base64url segment");
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) {
    throw new LicenseTokenError("INVALID_BASE64URL", "Non-canonical base64url segment");
  }
  return new Uint8Array(bytes);
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

export function decodeUtf8Strict(bytes: Uint8Array): string {
  try {
    return utf8.decode(bytes);
  } catch {
    throw new LicenseTokenError("INVALID_JSON", "Invalid UTF-8");
  }
}
