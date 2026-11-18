import { sign, verify, type KeyObject } from "node:crypto";
import { decodeBase64UrlStrict, decodeUtf8Strict, encodeBase64Url } from "./base64url.ts";
import { LicenseTokenError } from "./errors.ts";
import { isJsonObject, parseStrictJson } from "./strict-json.ts";
import {
  keyMatchesAlgorithm,
  SUPPORTED_ALGORITHMS,
  type JwsAlgorithm,
  type TrustedKey,
  type TrustedKeySet
} from "./trust-store.ts";

export const LICENSE_TOKEN_TYPE = "HYPEROFFICE-LICENSE+jws";
export const MAX_TOKEN_LENGTH = 16_384;
export const SUPPORTED_HEADER_VERSIONS: readonly number[] = [1];

const HEADER_MEMBERS = new Set(["typ", "alg", "kid", "ver"]);

export interface ProtectedHeader {
  typ: string;
  alg: JwsAlgorithm;
  kid: string;
  ver: number;
}

export interface VerifyOptions {
  trustedKeys: TrustedKeySet;
  allowedAlgorithms?: readonly JwsAlgorithm[];
  expectedType?: string;
}

export interface VerifiedToken {
  header: ProtectedHeader;
  payload: Record<string, unknown>;
  key: TrustedKey;
}

const fail = (code: ConstructorParameters<typeof LicenseTokenError>[0], message: string): never => {
  throw new LicenseTokenError(code, message);
};

/** Verifies a compact JWS. The payload is decoded only after the signature verifies. */
export function verifyCompactJws(token: string, options: VerifyOptions): VerifiedToken {
  const allowed = options.allowedAlgorithms ?? SUPPORTED_ALGORITHMS;
  const expectedType = options.expectedType ?? LICENSE_TOKEN_TYPE;

  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    fail("MALFORMED_TOKEN", "Token is empty or too long");
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    fail("MALFORMED_TOKEN", "Token must have three non-empty segments");
  }
  const [h, p, s] = parts as [string, string, string];

  const header = parseStrictJson(decodeUtf8Strict(decodeBase64UrlStrict(h)));
  if (!isJsonObject(header)) return fail("MALFORMED_TOKEN", "Header must be a JSON object");
  if ("crit" in header) fail("UNKNOWN_CRITICAL_HEADER", "No critical header extensions are supported");
  for (const name of Object.keys(header)) {
    if (!HEADER_MEMBERS.has(name)) fail("UNSUPPORTED_HEADER_PARAMETER", `Unsupported header parameter "${name}"`);
  }

  const { typ, alg, kid, ver } = header;
  if (typ !== expectedType) fail("UNSUPPORTED_TYPE", "Unexpected token type");
  if (typeof alg !== "string" || !allowed.includes(alg as JwsAlgorithm)) {
    fail("ALGORITHM_NOT_ALLOWED", "Algorithm is not on the allowlist");
  }
  if (typeof kid !== "string") return fail("UNKNOWN_KEY_ID", "Missing kid");
  if (typeof ver !== "number" || !SUPPORTED_HEADER_VERSIONS.includes(ver)) {
    fail("UNSUPPORTED_LICENSE_VERSION", "Unsupported token format version");
  }

  const trusted = options.trustedKeys.get(kid);
  if (!trusted) return fail("UNKNOWN_KEY_ID", "Key id is not trusted");
  if (trusted.alg !== alg || !keyMatchesAlgorithm(trusted.key, trusted.alg)) {
    fail("KEY_ALGORITHM_MISMATCH", "Algorithm does not match the trusted key");
  }
  if (trusted.status === "compromised") fail("KEY_NOT_USABLE", "Signing key is marked compromised");

  const signature = decodeBase64UrlStrict(s);
  if (signature.length !== 64) fail("INVALID_SIGNATURE", "Unexpected signature length");

  const signingInput = Buffer.from(`${h}.${p}`, "ascii");
  const valid =
    trusted.alg === "EdDSA"
      ? verify(null, signingInput, trusted.key, signature)
      : verify("sha256", signingInput, { key: trusted.key, dsaEncoding: "ieee-p1363" }, signature);
  if (!valid) fail("INVALID_SIGNATURE", "Signature verification failed");

  const payload = parseStrictJson(decodeUtf8Strict(decodeBase64UrlStrict(p)));
  if (!isJsonObject(payload)) return fail("INVALID_CLAIMS", "Payload must be a JSON object");

  return { header: { typ: expectedType, alg: trusted.alg, kid, ver: ver as number }, payload, key: trusted };
}

export function encodeSigningInput(header: ProtectedHeader, payload: object): string {
  const encode = (value: object) => encodeBase64Url(Buffer.from(JSON.stringify(value), "utf8"));
  return `${encode(header)}.${encode(payload)}`;
}

export function assembleCompactJws(signingInput: string, signature: Uint8Array): string {
  return `${signingInput}.${encodeBase64Url(signature)}`;
}

/** Signs with an in-process key. For development and test keys only; production signs in Key Vault/HSM. */
export function signWithLocalKey(alg: JwsAlgorithm, signingInput: string, privateKey: KeyObject): Uint8Array {
  const data = Buffer.from(signingInput, "ascii");
  return alg === "EdDSA"
    ? sign(null, data, privateKey)
    : sign("sha256", data, { key: privateKey, dsaEncoding: "ieee-p1363" });
}
