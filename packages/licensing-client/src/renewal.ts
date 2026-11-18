import { randomBytes, randomUUID } from "node:crypto";
import { normalizeActivationCode } from "@hyperoffice/licensing-core";
import { InvalidActivationCodeFormat } from "./activation.ts";
import type { GrantStore, InstallResult } from "./secure-storage.ts";

export interface RenewalRequestBody {
  extension_code: string;
  current_license_grant: string;
  installation_id: string;
  device_fingerprint: string;
  nonce: string;
  client_time: string;
}

export function prepareRenewal(input: {
  extensionCode: string;
  currentGrant: string;
  installationId: string;
  deviceFingerprint: string;
  now: Date;
}): { idempotencyKey: string; body: RenewalRequestBody } {
  const code = normalizeActivationCode(input.extensionCode);
  if (!code) throw new InvalidActivationCodeFormat();
  return {
    idempotencyKey: randomUUID(),
    body: {
      extension_code: code,
      current_license_grant: input.currentGrant,
      installation_id: input.installationId,
      device_fingerprint: input.deviceFingerprint,
      nonce: randomBytes(16).toString("base64url"),
      client_time: input.now.toISOString()
    }
  };
}

/** Validates and atomically installs the replacement grant returned by the renewal endpoint. */
export function applyRenewalResponse(store: GrantStore, replacementGrant: string, now: number): Promise<InstallResult> {
  return store.install(replacementGrant, now);
}
