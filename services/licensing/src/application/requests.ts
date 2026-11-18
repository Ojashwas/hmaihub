import { createHash } from "node:crypto";
import { isJsonObject, PATTERNS } from "@hyperoffice/licensing-core";

const NONCE = /^[A-Za-z0-9_-]{22,128}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;
const PLATFORMS = ["windows", "macos", "linux", "web"] as const;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export class RequestValidationError extends Error {}

type FieldRule = (v: unknown) => boolean;
const s =
  (pattern: RegExp, max = 256): FieldRule =>
  (v) =>
    typeof v === "string" && v.length <= max && pattern.test(v);

function validateShape<T>(body: unknown, rules: Record<string, FieldRule>): T {
  if (!isJsonObject(body)) throw new RequestValidationError("Body must be a JSON object");
  for (const key of Object.keys(body)) if (!(key in rules)) throw new RequestValidationError(`Unexpected field ${key}`);
  for (const [key, rule] of Object.entries(rules)) {
    if (!rule(body[key])) throw new RequestValidationError(`Invalid field ${key}`);
  }
  return body as T;
}

export interface ActivationRequest {
  code: string;
  product: string;
  installation_id: string;
  device_fingerprint: string;
  app_version: string;
  platform: (typeof PLATFORMS)[number];
  platform_version: string;
  nonce: string;
  client_time: string;
}

export function validateActivationRequest(body: unknown): ActivationRequest {
  return validateShape<ActivationRequest>(body, {
    code: s(/^[A-Za-z0-9 -]{1,80}$/, 80),
    product: s(PATTERNS.product, 64),
    installation_id: s(PATTERNS.installationId),
    device_fingerprint: s(PATTERNS.deviceBinding),
    app_version: s(/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]{1,32})?$/, 64),
    platform: (v) => typeof v === "string" && (PLATFORMS as readonly string[]).includes(v),
    platform_version: s(/^[0-9A-Za-z._ -]{1,32}$/, 32),
    nonce: s(NONCE),
    client_time: s(ISO_UTC, 32)
  });
}

export interface RenewalRequest {
  extension_code: string;
  current_license_grant: string;
  installation_id: string;
  device_fingerprint: string;
  nonce: string;
  client_time: string;
}

export function validateRenewalRequest(body: unknown): RenewalRequest {
  return validateShape<RenewalRequest>(body, {
    extension_code: s(/^[A-Za-z0-9 -]{1,80}$/, 80),
    current_license_grant: s(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 16_384),
    installation_id: s(PATTERNS.installationId),
    device_fingerprint: s(PATTERNS.deviceBinding),
    nonce: s(NONCE),
    client_time: s(ISO_UTC, 32)
  });
}

export function validateIdempotencyKey(key: unknown): string {
  if (typeof key !== "string" || !IDEMPOTENCY_KEY.test(key))
    throw new RequestValidationError("Invalid Idempotency-Key");
  return key;
}

export function requestHash(body: object): string {
  const sorted = Object.fromEntries(Object.entries(body).sort(([a], [b]) => (a < b ? -1 : 1)));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("base64url");
}
