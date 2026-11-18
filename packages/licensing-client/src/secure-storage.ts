import { createHash } from "node:crypto";
import type { GrantEvaluation } from "@hyperoffice/licensing-core";

/**
 * Platform secure store. Implementations must make `write` atomic per key:
 * Windows DPAPI (temp file + rename), macOS Keychain, Linux Secret Service.
 */
export interface SecureStore {
  read(key: string): Promise<Uint8Array | null>;
  write(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}

/** In-memory store for tests and development. Provides no protection at rest. */
export class MemorySecureStore implements SecureStore {
  readonly #data = new Map<string, Uint8Array>();

  async read(key: string): Promise<Uint8Array | null> {
    const v = this.#data.get(key);
    return v ? new Uint8Array(v) : null;
  }

  async write(key: string, value: Uint8Array): Promise<void> {
    this.#data.set(key, new Uint8Array(value));
  }

  async delete(key: string): Promise<void> {
    this.#data.delete(key);
  }
}

export interface StoredGrant {
  token: string;
  tokenHash: string;
  licenseId: string;
  licenseVersion: number;
  installedAt: number;
}

export interface InstalledLicenseRecord {
  current: StoredGrant;
  /** Superseded grant kept only for controlled rollback by support. */
  superseded?: StoredGrant;
}

export type InstallResult =
  | { installed: true; record: InstalledLicenseRecord }
  | {
      installed: false;
      reason: "VALIDATION_FAILED" | "ROLLBACK_REJECTED" | "STORAGE_FAILED";
      evaluation?: GrantEvaluation;
    };

const RECORD_KEY = "hyperoffice.license.record.v1";
const INSTALLABLE = new Set(["ALLOWED", "GRACE_PERIOD", "NOT_YET_VALID"]);

export const tokenHash = (token: string) => `sha256:${createHash("sha256").update(token, "ascii").digest("base64url")}`;

/**
 * Stores the signed grant. A replacement is validated before it is written,
 * licence versions may not go backwards, and a failed write leaves the
 * previous grant in place.
 */
export class GrantStore {
  readonly #store: SecureStore;
  readonly #validate: (token: string) => GrantEvaluation;

  constructor(store: SecureStore, validate: (token: string) => GrantEvaluation) {
    this.#store = store;
    this.#validate = validate;
  }

  async read(): Promise<InstalledLicenseRecord | null> {
    const raw = await this.#store.read(RECORD_KEY);
    if (!raw) return null;
    return JSON.parse(Buffer.from(raw).toString("utf8")) as InstalledLicenseRecord;
  }

  async install(token: string, now: number): Promise<InstallResult> {
    const evaluation = this.#validate(token);
    if (!INSTALLABLE.has(evaluation.status) || !evaluation.claims) {
      return { installed: false, reason: "VALIDATION_FAILED", evaluation };
    }
    const existing = await this.read();
    const claims = evaluation.claims;
    if (
      existing &&
      existing.current.licenseId === claims.license_id &&
      claims.license_version <= existing.current.licenseVersion
    ) {
      return { installed: false, reason: "ROLLBACK_REJECTED", evaluation };
    }
    const next: StoredGrant = {
      token,
      tokenHash: tokenHash(token),
      licenseId: claims.license_id,
      licenseVersion: claims.license_version,
      installedAt: now
    };
    const record: InstalledLicenseRecord = existing
      ? { current: next, superseded: existing.current }
      : { current: next };
    try {
      await this.#store.write(RECORD_KEY, Buffer.from(JSON.stringify(record), "utf8"));
    } catch {
      return { installed: false, reason: "STORAGE_FAILED", evaluation };
    }
    return { installed: true, record };
  }
}
