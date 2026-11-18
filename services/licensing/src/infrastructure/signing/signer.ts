import { createPublicKey, type KeyObject } from "node:crypto";
import { signWithLocalKey, type JwsAlgorithm, type KeyEnvironment, type KeyStatus } from "@hyperoffice/licensing-core";

/** Signing port. Production implementation: Azure Key Vault / Managed HSM (Phase L5, not implemented). */
export interface GrantSigner {
  readonly kid: string;
  readonly alg: JwsAlgorithm;
  readonly environment: KeyEnvironment;
  sign(signingInput: string): Promise<Uint8Array>;
  publicJwk(status: KeyStatus): Record<string, unknown>;
}

/**
 * In-process signer for development and test keys. Refuses to operate with
 * a production environment label, so it cannot be misconfigured as the
 * production signer.
 */
export class LocalDevelopmentSigner implements GrantSigner {
  readonly kid: string;
  readonly alg: JwsAlgorithm;
  readonly environment: KeyEnvironment;
  readonly #privateKey: KeyObject;

  constructor(options: { kid: string; alg: JwsAlgorithm; environment: "development" | "test"; privateKey: KeyObject }) {
    if ((options.environment as string) === "production" || (options.environment as string) === "staging") {
      throw new Error("LocalDevelopmentSigner must not be used for staging or production keys");
    }
    if (options.privateKey.type !== "private") throw new Error("A private key is required");
    this.kid = options.kid;
    this.alg = options.alg;
    this.environment = options.environment;
    this.#privateKey = options.privateKey;
  }

  async sign(signingInput: string): Promise<Uint8Array> {
    return signWithLocalKey(this.alg, signingInput, this.#privateKey);
  }

  publicJwk(status: KeyStatus): Record<string, unknown> {
    const jwk = createPublicKey(this.#privateKey).export({ format: "jwk" });
    return { ...jwk, kid: this.kid, alg: this.alg, use: "sig", status, environment: this.environment };
  }
}
