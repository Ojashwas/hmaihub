import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  type KeyObject
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addCalendarMonthsUtc,
  assembleCompactJws,
  computeGraceUntil,
  encodeSigningInput,
  LICENSE_TOKEN_TYPE,
  signWithLocalKey,
  type LicenseGrantClaims
} from "@hyperoffice/licensing-core";

export const DEV_ISSUER = "https://license.dev.hyperoffice.invalid";
export const DEV_AUDIENCE = "hyperoffice-desktop";

export interface DevKey {
  kid: string;
  privateKey: KeyObject;
  publicJwk: Record<string, unknown>;
}

export function assertNotProduction(env: NodeJS.ProcessEnv = process.env): void {
  const value = (env["HYPEROFFICE_ENV"] ?? "").toLowerCase();
  if (value === "production" || value === "staging") {
    throw new Error("The development licence issuer is disabled in staging and production environments.");
  }
}

/** Loads or creates the per-machine development key. The directory must be git-ignored. */
export function loadOrCreateDevKey(dir: string): DevKey {
  assertNotProduction();
  const keyPath = join(dir, "ho-license-dev.pem");
  if (!existsSync(keyPath)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const { privateKey } = generateKeyPairSync("ed25519");
    writeFileSync(keyPath, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600, flag: "wx" });
  }
  const privateKey = createPrivateKey(readFileSync(keyPath));
  const jwk = createPublicKey(privateKey).export({ format: "jwk" });
  const kid = `ho-license-dev-${createHash("sha256").update(String(jwk.x)).digest("hex").slice(0, 12)}`;
  const publicJwk = { ...jwk, kid, alg: "EdDSA", use: "sig", status: "active", environment: "development" };
  writeFileSync(join(dir, "ho-license-dev.public.json"), `${JSON.stringify({ keys: [publicJwk] }, null, 2)}\n`);
  return { kid, privateKey, publicJwk };
}

export interface DevGrantOptions {
  installationId: string;
  deviceBinding: string;
  products?: string[];
  features?: string[];
  months?: number;
  now?: Date;
}

export function issueDevelopmentGrant(
  key: DevKey,
  options: DevGrantOptions
): { token: string; claims: LicenseGrantClaims } {
  assertNotProduction();
  const iat = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const exp = addCalendarMonthsUtc(iat, options.months ?? 6);
  const id = randomBytes(10).toString("hex").toUpperCase();
  const claims: LicenseGrantClaims = {
    iss: DEV_ISSUER,
    aud: DEV_AUDIENCE,
    jti: `dev_${id}`,
    license_id: `lic_DEV${id}`,
    customer_id: "cus_DEVELOPER0001",
    edition: "developer",
    license_mode: "development",
    products: options.products ?? ["hyperoffice-suite"],
    features: options.features ?? [
      "documents.edit",
      "spreadsheets.formulas",
      "presentations.edit",
      "projects.schedule"
    ],
    limits: { installations: 1, users: 1, ai_monthly_credits: 0 },
    installation_id: options.installationId,
    device_binding: options.deviceBinding,
    license_version: 1,
    policy_version: 1,
    iat,
    nbf: iat,
    exp,
    grace_until: computeGraceUntil(exp, 14)
  };
  const input = encodeSigningInput({ typ: LICENSE_TOKEN_TYPE, alg: "EdDSA", kid: key.kid, ver: 1 }, claims);
  return { token: assembleCompactJws(input, signWithLocalKey("EdDSA", input, key.privateKey)), claims };
}
