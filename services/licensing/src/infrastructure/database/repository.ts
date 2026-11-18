import type { AuditEvent, AuditEventInput } from "../../domain/audit-event.ts";
import type {
  ActivationCodeRecord,
  ActivationRecord,
  EntitlementTemplate,
  GrantRecord,
  IdempotencyRecord,
  InstallationRecord,
  LicenseRecord
} from "../../domain/types.ts";

/** Operations available inside a SERIALIZABLE transaction. */
export interface LicensingTx {
  getCodeByHash(codeHash: string): Promise<ActivationCodeRecord | undefined>;
  putCode(record: ActivationCodeRecord): Promise<void>;
  getTemplate(templateId: string): Promise<EntitlementTemplate | undefined>;
  putTemplate(template: EntitlementTemplate): Promise<void>;
  getLicense(licenseId: string): Promise<LicenseRecord | undefined>;
  putLicense(record: LicenseRecord): Promise<void>;
  getInstallation(licenseId: string, installationId: string): Promise<InstallationRecord | undefined>;
  putInstallation(record: InstallationRecord): Promise<void>;
  countActiveInstallations(licenseId: string): Promise<number>;
  putActivation(record: ActivationRecord): Promise<void>;
  getLatestGrant(licenseId: string, installationId: string): Promise<GrantRecord | undefined>;
  putGrant(record: GrantRecord): Promise<void>;
  getIdempotency(scope: string, key: string): Promise<IdempotencyRecord | undefined>;
  putIdempotency(record: IdempotencyRecord): Promise<void>;
  /** Returns true if the nonce was already used at or after `since`. */
  nonceSeen(nonce: string, since: number): Promise<boolean>;
  putNonce(nonce: string, at: number): Promise<void>;
  appendAudit(input: AuditEventInput, at: Date): Promise<AuditEvent>;
}

export interface LicensingRepository {
  /** Runs `fn` with serializable isolation; any thrown error rolls back every write. */
  transaction<T>(fn: (tx: LicensingTx) => Promise<T>): Promise<T>;
  /** Appends an audit event in its own transaction (used for failed attempts). */
  audit(input: AuditEventInput, at: Date): Promise<AuditEvent>;
}
