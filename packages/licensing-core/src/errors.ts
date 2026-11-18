export type LicenseStatus =
  | "ALLOWED"
  | "NOT_ENTITLED"
  | "EXPIRED"
  | "GRACE_PERIOD"
  | "INVALID_SIGNATURE"
  | "WRONG_INSTALLATION"
  | "NOT_YET_VALID"
  | "UNSUPPORTED_LICENSE_VERSION"
  | "CLOCK_TAMPER_SUSPECTED"
  | "LICENSING_COMPONENT_UNAVAILABLE";

export type TokenErrorCode =
  | "MALFORMED_TOKEN"
  | "INVALID_BASE64URL"
  | "INVALID_JSON"
  | "DUPLICATE_JSON_MEMBER"
  | "UNSUPPORTED_TYPE"
  | "UNSUPPORTED_HEADER_PARAMETER"
  | "UNKNOWN_CRITICAL_HEADER"
  | "ALGORITHM_NOT_ALLOWED"
  | "UNKNOWN_KEY_ID"
  | "KEY_ALGORITHM_MISMATCH"
  | "KEY_NOT_USABLE"
  | "INVALID_SIGNATURE"
  | "INVALID_CLAIMS"
  | "UNKNOWN_ISSUER"
  | "UNKNOWN_AUDIENCE"
  | "UNSUPPORTED_LICENSE_VERSION";

export class LicenseTokenError extends Error {
  readonly code: TokenErrorCode;

  constructor(code: TokenErrorCode, message: string) {
    super(message);
    this.name = "LicenseTokenError";
    this.code = code;
  }
}

/** Maps a token-level failure to the client-facing licence status. */
export function statusForTokenError(code: TokenErrorCode): LicenseStatus {
  switch (code) {
    case "UNSUPPORTED_LICENSE_VERSION":
      return "UNSUPPORTED_LICENSE_VERSION";
    default:
      return "INVALID_SIGNATURE";
  }
}
