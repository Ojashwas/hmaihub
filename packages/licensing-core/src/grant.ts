import { LicenseTokenError, statusForTokenError, type LicenseStatus } from "./errors.ts";
import { verifyCompactJws, type VerifyOptions } from "./jws.ts";
import { isJsonObject } from "./strict-json.ts";

export const EDITIONS = [
  "trial",
  "individual",
  "professional",
  "business",
  "enterprise",
  "education",
  "developer",
  "internal_testing"
] as const;
export type Edition = (typeof EDITIONS)[number];

export const LICENSE_MODES = [
  "subscription",
  "fixed_term",
  "perpetual_maintenance",
  "enterprise_offline",
  "floating",
  "development"
] as const;
export type LicenseMode = (typeof LICENSE_MODES)[number];

export const SUITE_PRODUCT = "hyperoffice-suite";
export const SUPPORTED_POLICY_VERSIONS: readonly number[] = [1];

export interface LicenseLimits {
  installations: number;
  users: number;
  ai_monthly_credits: number;
}

export interface LicenseGrantClaims {
  iss: string;
  aud: string;
  jti: string;
  license_id: string;
  customer_id: string;
  order_id?: string;
  edition: Edition;
  license_mode: LicenseMode;
  products: string[];
  features: string[];
  limits: LicenseLimits;
  installation_id: string;
  device_binding: string;
  license_version: number;
  policy_version: number;
  iat: number;
  nbf: number;
  exp: number;
  grace_until: number;
  maintenance_until?: number;
}

const KNOWN_CLAIMS = new Set([
  "iss",
  "aud",
  "jti",
  "license_id",
  "customer_id",
  "order_id",
  "edition",
  "license_mode",
  "products",
  "features",
  "limits",
  "installation_id",
  "device_binding",
  "license_version",
  "policy_version",
  "iat",
  "nbf",
  "exp",
  "grace_until",
  "maintenance_until"
]);

export const PATTERNS = {
  licenseId: /^lic_[0-9A-Za-z]{8,64}$/,
  customerId: /^cus_[0-9A-Za-z]{8,64}$/,
  orderId: /^ord_[0-9A-Za-z]{8,64}$/,
  installationId: /^ins_[0-9A-Za-z]{8,64}$/,
  jti: /^[0-9A-Za-z_-]{8,128}$/,
  product: /^[a-z][a-z0-9-]{1,63}$/,
  feature: /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/,
  deviceBinding: /^sha256:[A-Za-z0-9_-]{43}$/
} as const;

const invalid = (message: string): never => {
  throw new LicenseTokenError("INVALID_CLAIMS", message);
};

function str(payload: Record<string, unknown>, name: string, pattern?: RegExp): string {
  const v = payload[name];
  if (typeof v !== "string" || v.length === 0 || v.length > 512) return invalid(`Claim ${name} must be a string`);
  if (pattern && !pattern.test(v)) invalid(`Claim ${name} has an invalid format`);
  return v;
}

function int(payload: Record<string, unknown>, name: string, min = 0): number {
  const v = payload[name];
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min)
    return invalid(`Claim ${name} must be an integer >= ${min}`);
  return v;
}

function list(payload: Record<string, unknown>, name: string, pattern: RegExp, max: number): string[] {
  const v = payload[name];
  if (!Array.isArray(v) || v.length > max) return invalid(`Claim ${name} must be an array of at most ${max}`);
  const out = v.map((item) => {
    if (typeof item !== "string" || !pattern.test(item)) return invalid(`Claim ${name} contains an invalid entry`);
    return item;
  });
  if (new Set(out).size !== out.length) invalid(`Claim ${name} contains duplicates`);
  return out;
}

/** Validates claim types and internal consistency. Does not evaluate time or binding. */
export function parseGrantClaims(payload: Record<string, unknown>): LicenseGrantClaims {
  for (const name of Object.keys(payload)) {
    if (!KNOWN_CLAIMS.has(name)) invalid(`Unknown claim "${name}"`);
  }
  const policyVersion = int(payload, "policy_version", 1);
  if (!SUPPORTED_POLICY_VERSIONS.includes(policyVersion)) {
    throw new LicenseTokenError("UNSUPPORTED_LICENSE_VERSION", "Unsupported licence policy version");
  }
  const edition = str(payload, "edition");
  if (!EDITIONS.includes(edition as Edition)) invalid("Unknown edition");
  const mode = str(payload, "license_mode");
  if (!LICENSE_MODES.includes(mode as LicenseMode)) invalid("Unknown licence mode");

  const limitsRaw = payload["limits"];
  if (!isJsonObject(limitsRaw)) return invalid("Claim limits must be an object");
  const limits: LicenseLimits = {
    installations: int(limitsRaw, "installations", 1),
    users: int(limitsRaw, "users", 1),
    ai_monthly_credits: int(limitsRaw, "ai_monthly_credits", 0)
  };

  const claims: LicenseGrantClaims = {
    iss: str(payload, "iss"),
    aud: str(payload, "aud"),
    jti: str(payload, "jti", PATTERNS.jti),
    license_id: str(payload, "license_id", PATTERNS.licenseId),
    customer_id: str(payload, "customer_id", PATTERNS.customerId),
    edition: edition as Edition,
    license_mode: mode as LicenseMode,
    products: list(payload, "products", PATTERNS.product, 32),
    features: list(payload, "features", PATTERNS.feature, 512),
    limits,
    installation_id: str(payload, "installation_id", PATTERNS.installationId),
    device_binding: str(payload, "device_binding", PATTERNS.deviceBinding),
    license_version: int(payload, "license_version", 1),
    policy_version: policyVersion,
    iat: int(payload, "iat"),
    nbf: int(payload, "nbf"),
    exp: int(payload, "exp"),
    grace_until: int(payload, "grace_until")
  };
  if ("order_id" in payload) claims.order_id = str(payload, "order_id", PATTERNS.orderId);
  if ("maintenance_until" in payload) claims.maintenance_until = int(payload, "maintenance_until");

  if (claims.products.length === 0) invalid("At least one product is required");
  if (claims.nbf < claims.iat - 300) invalid("nbf precedes iat by more than the allowed skew");
  if (claims.exp <= claims.nbf) invalid("exp must be after nbf");
  if (claims.grace_until < claims.exp) invalid("grace_until must not precede exp");
  return claims;
}

export interface GrantValidationContext extends VerifyOptions {
  expectedIssuer: string;
  expectedAudience: string;
  /** Product the running application represents, e.g. "hyperdoc". */
  product: string;
  installationId: string;
  /** Composite fingerprint recorded at activation and confirmed by the device-binding policy. */
  deviceBinding: string;
  /** Trusted current time in epoch seconds (after clock-rollback checks). */
  now: number;
}

export interface GrantEvaluation {
  status: LicenseStatus;
  reason: string;
  claims?: LicenseGrantClaims;
  kid?: string;
}

/** Full offline validation pipeline (signature, claims, issuer, audience, product, binding, time). */
export function evaluateGrant(token: string, ctx: GrantValidationContext): GrantEvaluation {
  let claims: LicenseGrantClaims;
  let kid: string;
  try {
    const verified = verifyCompactJws(token, ctx);
    claims = parseGrantClaims(verified.payload);
    kid = verified.header.kid;
  } catch (err) {
    if (err instanceof LicenseTokenError) return { status: statusForTokenError(err.code), reason: err.code };
    throw err;
  }

  if (claims.iss !== ctx.expectedIssuer) return { status: "INVALID_SIGNATURE", reason: "UNKNOWN_ISSUER", kid };
  if (claims.aud !== ctx.expectedAudience) return { status: "INVALID_SIGNATURE", reason: "UNKNOWN_AUDIENCE", kid };
  if (claims.installation_id !== ctx.installationId || claims.device_binding !== ctx.deviceBinding) {
    return { status: "WRONG_INSTALLATION", reason: "INSTALLATION_MISMATCH", claims, kid };
  }
  if (!claims.products.includes(ctx.product) && !claims.products.includes(SUITE_PRODUCT)) {
    return { status: "NOT_ENTITLED", reason: "PRODUCT_NOT_LICENSED", claims, kid };
  }
  if (ctx.now < claims.nbf) return { status: "NOT_YET_VALID", reason: "NOT_YET_VALID", claims, kid };
  if (ctx.now < claims.exp) return { status: "ALLOWED", reason: "VALID", claims, kid };
  if (ctx.now < claims.grace_until) return { status: "GRACE_PERIOD", reason: "IN_GRACE_PERIOD", claims, kid };
  return { status: "EXPIRED", reason: "EXPIRED", claims, kid };
}

/** Licence state consumed by the entitlement SDK. */
export interface LicenseSnapshot {
  status: LicenseStatus;
  products: readonly string[];
  features: readonly string[];
  expiresAt?: number;
  graceUntil?: number;
}

export function snapshotFromEvaluation(evaluation: GrantEvaluation): LicenseSnapshot {
  const c = evaluation.claims;
  if (!c) return { status: evaluation.status, products: [], features: [] };
  return {
    status: evaluation.status,
    products: c.products,
    features: c.features,
    expiresAt: c.exp,
    graceUntil: c.grace_until
  };
}
