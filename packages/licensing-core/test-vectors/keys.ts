import { createHash, createPrivateKey, type KeyObject } from "node:crypto";
import { addCalendarMonthsUtc, computeGraceUntil } from "../src/policies.ts";

// RFC 8032 section 7.1 TEST 1. Publicly known; trusted only in "test" environment stores.
export const RFC8032_TEST1_SEED_HEX = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
export const RFC8032_TEST1_PUBLIC_HEX = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
export const TEST_EDDSA_KID = "ho-license-test-rfc8032-1";

export function rfc8032PrivateKey(): KeyObject {
  return createPrivateKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      d: Buffer.from(RFC8032_TEST1_SEED_HEX, "hex").toString("base64url"),
      x: Buffer.from(RFC8032_TEST1_PUBLIC_HEX, "hex").toString("base64url")
    },
    format: "jwk"
  });
}

export const TEST_EDDSA_PUBLIC_JWK = {
  kty: "OKP",
  crv: "Ed25519",
  x: Buffer.from(RFC8032_TEST1_PUBLIC_HEX, "hex").toString("base64url"),
  kid: TEST_EDDSA_KID,
  alg: "EdDSA",
  use: "sig",
  status: "active",
  environment: "test"
} as const;

export const TEST_ISSUER = "https://license.hyperoffice.example";
export const TEST_AUDIENCE = "hyperoffice-desktop";
export const TEST_INSTALLATION_ID = "ins_01JTESTVECTOR0001";
export const TEST_DEVICE_BINDING = `sha256:${createHash("sha256").update("hyperoffice-test-device").digest("base64url")}`;
export const TEST_IAT = 1_790_000_000;
export const TEST_EXP = addCalendarMonthsUtc(TEST_IAT, 6);

export const SAMPLE_CLAIMS = {
  iss: TEST_ISSUER,
  aud: TEST_AUDIENCE,
  jti: "01JTESTVECTOR00000000000001",
  license_id: "lic_01JTESTVECTOR0001",
  customer_id: "cus_01JTESTVECTOR0001",
  order_id: "ord_01JTESTVECTOR0001",
  edition: "professional",
  license_mode: "subscription",
  products: ["hyperdoc", "hypersheet", "hyperdeck", "hyperplan"],
  features: [
    "documents.edit",
    "spreadsheets.formulas",
    "presentations.edit",
    "projects.schedule",
    "office.import",
    "office.export"
  ],
  limits: { installations: 2, users: 1, ai_monthly_credits: 0 },
  installation_id: TEST_INSTALLATION_ID,
  device_binding: TEST_DEVICE_BINDING,
  license_version: 1,
  policy_version: 1,
  iat: TEST_IAT,
  nbf: TEST_IAT,
  exp: TEST_EXP,
  grace_until: computeGraceUntil(TEST_EXP, 14)
};
