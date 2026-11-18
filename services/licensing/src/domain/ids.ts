import { randomBytes } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Opaque random identifier: "<prefix>_" + 26 Crockford base32 symbols (130 bits). Never sequential. */
export function newId(prefix: "lic" | "cus" | "act" | "code" | "aud" | "tpl" | "ord" | "jti" | "hsr"): string {
  let out = `${prefix}_`;
  for (const b of randomBytes(26)) out += CROCKFORD[b & 31];
  return out;
}
