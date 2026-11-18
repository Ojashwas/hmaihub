import { generateKeyPairSync, randomBytes } from "node:crypto";
import { trustedKeySetFromJwks, type GrantValidationContext } from "@hyperoffice/licensing-core";
import {
  DEFAULT_POLICY,
  FixedWindowRateLimiter,
  InMemoryLicensingRepository,
  issueCodes,
  LocalDevelopmentSigner,
  type EntitlementTemplate,
  type LicensingConfig,
  type LicensingDeps
} from "../src/index.ts";

export const ISSUER = "https://license.hyperoffice.example";
export const AUDIENCE = "hyperoffice-desktop";
export const NOW = new Date("2026-11-18T09:30:00Z");
export const DAY = 86_400;
export const at = (d: Date, days: number) => new Date(d.getTime() + days * DAY * 1000);
export const epoch = (d: Date) => Math.floor(d.getTime() / 1000);

export const TEMPLATES: EntitlementTemplate[] = [
  {
    templateId: "tpl_PRO6M",
    kind: "activation",
    edition: "professional",
    licenseMode: "subscription",
    products: ["hyperdoc", "hypersheet", "hyperdeck", "hyperplan"],
    features: [
      "documents.edit",
      "spreadsheets.formulas",
      "presentations.edit",
      "projects.schedule",
      "office.import",
      "office.export"
    ],
    limits: { installations: 2, users: 1, ai_monthly_credits: 0 }
  },
  {
    templateId: "tpl_DOCONLY",
    kind: "activation",
    edition: "individual",
    licenseMode: "subscription",
    products: ["hyperdoc"],
    features: ["documents.edit"],
    limits: { installations: 1, users: 1, ai_monthly_credits: 0 }
  },
  {
    templateId: "tpl_RENEW6M",
    kind: "renewal",
    edition: "professional",
    licenseMode: "subscription",
    products: ["hyperdoc"],
    features: [],
    limits: { installations: 0, users: 0, ai_monthly_credits: 0 },
    term: { unit: "months", length: 6 }
  },
  {
    templateId: "tpl_TRACK",
    kind: "feature",
    edition: "professional",
    licenseMode: "subscription",
    products: ["hyperdoc"],
    features: ["hyperdoc.track_changes"],
    limits: { installations: 1, users: 0, ai_monthly_credits: 0 }
  }
];

export function makeSigner(kid = "ho-license-test-1") {
  return new LocalDevelopmentSigner({
    kid,
    alg: "EdDSA",
    environment: "test",
    privateKey: generateKeyPairSync("ed25519").privateKey
  });
}

export async function setup(overrides: Partial<LicensingConfig> = {}) {
  const signer = makeSigner();
  const verificationKeys = trustedKeySetFromJwks([signer.publicJwk("active")], ["test"]);
  const config: LicensingConfig = {
    ...DEFAULT_POLICY,
    issuer: ISSUER,
    audience: AUDIENCE,
    publicKeySetUrl: `${ISSUER}/.well-known/hyperoffice-license-keys.json`,
    verificationKeys,
    ...overrides
  };
  const repo = new InMemoryLicensingRepository();
  for (const t of TEMPLATES) await repo.transaction((tx) => tx.putTemplate(t));
  const deps: LicensingDeps = { repo, signer, pepper: randomBytes(32), limiter: new FixedWindowRateLimiter(), config };
  return { deps, repo, signer, verificationKeys };
}

export async function issueOne(
  deps: LicensingDeps,
  templateId: string,
  opts: { maxInstallations?: number; redeemBy?: Date; customerId?: string } = {}
): Promise<string> {
  const [issued] = await issueCodes(deps, {
    templateId,
    quantity: 1,
    redeemBy: epoch(opts.redeemBy ?? at(NOW, 365)),
    maxInstallations: opts.maxInstallations ?? 1,
    channel: "direct",
    orderId: "ord_TEST000000000001",
    createdBy: "operator@hyperoffice.example",
    now: NOW,
    ...(opts.customerId === undefined ? {} : { customerId: opts.customerId })
  });
  if (!issued) throw new Error("no code issued");
  return issued.code;
}

let counter = 0;
export function installation() {
  counter++;
  return {
    id: `ins_TEST${String(counter).padStart(12, "0")}`,
    fingerprint: `sha256:${randomBytes(32).toString("base64url")}`
  };
}

export function activationBody(code: string, ins: { id: string; fingerprint: string }, product = "hyperoffice-suite") {
  return {
    code,
    product,
    installation_id: ins.id,
    device_fingerprint: ins.fingerprint,
    app_version: "0.1.0",
    platform: "windows",
    platform_version: "11",
    nonce: randomBytes(16).toString("base64url"),
    client_time: "2026-11-18T09:30:00Z"
  };
}

export const key = () => randomBytes(18).toString("base64url");

export function clientContext(
  verificationKeys: GrantValidationContext["trustedKeys"],
  ins: { id: string; fingerprint: string },
  now: Date,
  product = "hyperdoc"
): GrantValidationContext {
  return {
    trustedKeys: verificationKeys,
    expectedIssuer: ISSUER,
    expectedAudience: AUDIENCE,
    product,
    installationId: ins.id,
    deviceBinding: ins.fingerprint,
    now: epoch(now)
  };
}
