import { createPublicKey, type KeyObject } from "node:crypto";
import { LicenseTokenError } from "./errors.ts";
import { isJsonObject } from "./strict-json.ts";

export type JwsAlgorithm = "EdDSA" | "ES256";
export const SUPPORTED_ALGORITHMS: readonly JwsAlgorithm[] = ["EdDSA", "ES256"];

export type KeyStatus = "next" | "active" | "retired" | "compromised";
export type KeyEnvironment = "production" | "staging" | "development" | "test";

export interface PublicJwk {
  kty: "OKP" | "EC";
  crv: "Ed25519" | "P-256";
  x: string;
  y?: string;
  kid: string;
  alg: JwsAlgorithm;
  use?: "sig";
  status: KeyStatus;
  environment: KeyEnvironment;
}

export interface TrustedKey {
  kid: string;
  alg: JwsAlgorithm;
  status: KeyStatus;
  environment: KeyEnvironment;
  key: KeyObject;
}

const KID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const STATUSES: readonly KeyStatus[] = ["next", "active", "retired", "compromised"];

export function keyMatchesAlgorithm(key: KeyObject, alg: JwsAlgorithm): boolean {
  if (key.type !== "public") return false;
  if (alg === "EdDSA") return key.asymmetricKeyType === "ed25519";
  return key.asymmetricKeyType === "ec" && key.asymmetricKeyDetails?.namedCurve === "prime256v1";
}

export class TrustedKeySet {
  readonly #keys = new Map<string, TrustedKey>();

  constructor(keys: readonly TrustedKey[]) {
    for (const k of keys) {
      if (this.#keys.has(k.kid)) throw new Error(`Duplicate key id ${k.kid}`);
      if (!keyMatchesAlgorithm(k.key, k.alg)) throw new Error(`Key ${k.kid} does not match algorithm ${k.alg}`);
      this.#keys.set(k.kid, k);
    }
  }

  get(kid: string): TrustedKey | undefined {
    return this.#keys.get(kid);
  }

  kids(): string[] {
    return [...this.#keys.keys()];
  }
}

/**
 * Builds a trust store from public JWKs. Keys outside `allowedEnvironments`
 * are rejected so production builds cannot silently trust development keys.
 */
export function trustedKeySetFromJwks(
  jwks: readonly unknown[],
  allowedEnvironments: readonly KeyEnvironment[]
): TrustedKeySet {
  const keys = jwks.map((raw): TrustedKey => {
    if (!isJsonObject(raw)) throw new LicenseTokenError("KEY_NOT_USABLE", "JWK must be an object");
    if ("d" in raw || "p" in raw || "q" in raw) {
      throw new LicenseTokenError("KEY_NOT_USABLE", "Private key material is not allowed in a trust store");
    }
    const { kty, crv, x, y, kid, alg, status, environment } = raw;
    if (typeof kid !== "string" || !KID_PATTERN.test(kid)) {
      throw new LicenseTokenError("KEY_NOT_USABLE", "Invalid kid");
    }
    if (typeof status !== "string" || !STATUSES.includes(status as KeyStatus)) {
      throw new LicenseTokenError("KEY_NOT_USABLE", `Invalid status for ${kid}`);
    }
    if (typeof environment !== "string" || !allowedEnvironments.includes(environment as KeyEnvironment)) {
      throw new LicenseTokenError("KEY_NOT_USABLE", `Key ${kid} environment is not trusted in this build`);
    }
    let jwk: Record<string, string>;
    if (alg === "EdDSA" && kty === "OKP" && crv === "Ed25519" && typeof x === "string") {
      jwk = { kty, crv, x };
    } else if (alg === "ES256" && kty === "EC" && crv === "P-256" && typeof x === "string" && typeof y === "string") {
      jwk = { kty, crv, x, y };
    } else {
      throw new LicenseTokenError("KEY_ALGORITHM_MISMATCH", `Unsupported key parameters for ${kid}`);
    }
    return {
      kid,
      alg,
      status: status as KeyStatus,
      environment: environment as KeyEnvironment,
      key: createPublicKey({ key: jwk, format: "jwk" })
    };
  });
  return new TrustedKeySet(keys);
}
