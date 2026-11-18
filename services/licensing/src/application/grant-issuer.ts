import {
  assembleCompactJws,
  computeGraceUntil,
  encodeSigningInput,
  LICENSE_TOKEN_TYPE,
  type LicenseGrantClaims
} from "@hyperoffice/licensing-core";
import { newId } from "../domain/ids.ts";
import type { GrantRecord, InstallationRecord, LicenseRecord } from "../domain/types.ts";
import type { GrantSigner } from "../infrastructure/signing/signer.ts";
import type { LicensingConfig } from "./config.ts";

export async function signLicenseGrant(
  signer: GrantSigner,
  config: Pick<LicensingConfig, "issuer" | "audience">,
  license: LicenseRecord,
  installation: InstallationRecord,
  now: number,
  supersedesJti?: string
): Promise<{ token: string; grant: GrantRecord }> {
  const claims: LicenseGrantClaims = {
    iss: config.issuer,
    aud: config.audience,
    jti: newId("jti"),
    license_id: license.licenseId,
    customer_id: license.customerId,
    ...(license.orderId === undefined ? {} : { order_id: license.orderId }),
    edition: license.edition,
    license_mode: license.licenseMode,
    products: license.products,
    features: license.features,
    limits: license.limits,
    installation_id: installation.installationId,
    device_binding: installation.deviceFingerprint,
    license_version: license.licenseVersion,
    policy_version: 1,
    iat: now,
    nbf: Math.max(license.nbf, now),
    exp: license.exp,
    grace_until: license.graceUntil
  };
  const input = encodeSigningInput({ typ: LICENSE_TOKEN_TYPE, alg: signer.alg, kid: signer.kid, ver: 1 }, claims);
  const token = assembleCompactJws(input, await signer.sign(input));
  return {
    token,
    grant: {
      jti: claims.jti,
      licenseId: license.licenseId,
      installationId: installation.installationId,
      licenseVersion: license.licenseVersion,
      kid: signer.kid,
      issuedAt: now,
      exp: license.exp,
      ...(supersedesJti === undefined ? {} : { supersedesJti })
    }
  };
}

export function withGrace(license: LicenseRecord, exp: number, graceDays: number): LicenseRecord {
  return { ...license, exp, graceUntil: computeGraceUntil(exp, graceDays) };
}
