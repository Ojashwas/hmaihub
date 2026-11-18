import { randomBytes, randomUUID } from "node:crypto";
import { normalizeActivationCode } from "@hyperoffice/licensing-core";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Opaque installation identifier: "ins_" + 26 Crockford base32 symbols (130 random bits). */
export function createInstallationId(): string {
  const bytes = randomBytes(26);
  let out = "ins_";
  // 256 is a multiple of 32, so masking introduces no modulo bias.
  for (const b of bytes) out += CROCKFORD[b & 31];
  return out;
}

export interface ActivationRequestBody {
  code: string;
  product: string;
  installation_id: string;
  device_fingerprint: string;
  app_version: string;
  platform: "windows" | "macos" | "linux" | "web";
  platform_version: string;
  nonce: string;
  client_time: string;
}

export interface PreparedActivation {
  idempotencyKey: string;
  body: ActivationRequestBody;
}

export class InvalidActivationCodeFormat extends Error {
  constructor() {
    super("The activation code is not in a valid format. Check for typing errors.");
    this.name = "InvalidActivationCodeFormat";
  }
}

/**
 * Prepares a POST /v1/activations request. Retries after a timeout must
 * resend the same prepared object so the server can de-duplicate it.
 */
export function prepareActivation(
  input: Omit<ActivationRequestBody, "nonce" | "client_time" | "code"> & { code: string; now: Date }
): PreparedActivation {
  const code = normalizeActivationCode(input.code);
  if (!code) throw new InvalidActivationCodeFormat();
  return {
    idempotencyKey: randomUUID(),
    body: {
      code,
      product: input.product,
      installation_id: input.installation_id,
      device_fingerprint: input.device_fingerprint,
      app_version: input.app_version,
      platform: input.platform,
      platform_version: input.platform_version,
      nonce: randomBytes(16).toString("base64url"),
      client_time: input.now.toISOString()
    }
  };
}
