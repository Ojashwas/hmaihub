import { createHmac } from "node:crypto";

/**
 * code_hash = HMAC-SHA-256(server_pepper, normalized_code).
 * In production the pepper is held in Azure Key Vault and supplied through a managed identity.
 */
export function hashActivationCode(pepper: Uint8Array, normalizedCode: string): string {
  if (pepper.length < 32) throw new Error("Code-hash pepper must be at least 256 bits");
  return `hmac-sha256:${createHmac("sha256", pepper).update(normalizedCode, "ascii").digest("base64url")}`;
}
