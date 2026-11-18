import { chainAuditEvent, type AuditEvent, type AuditEventInput } from "../../domain/audit-event.ts";
import { newId } from "../../domain/ids.ts";
import type {
  ActivationCodeRecord,
  ActivationRecord,
  EntitlementTemplate,
  GrantRecord,
  IdempotencyRecord,
  InstallationRecord,
  LicenseRecord
} from "../../domain/types.ts";
import type { LicensingRepository, LicensingTx } from "./repository.ts";

interface State {
  codes: Map<string, ActivationCodeRecord>;
  templates: Map<string, EntitlementTemplate>;
  licenses: Map<string, LicenseRecord>;
  installations: Map<string, InstallationRecord>;
  activations: ActivationRecord[];
  grants: GrantRecord[];
  idempotency: Map<string, IdempotencyRecord>;
  nonces: Map<string, number>;
  audit: AuditEvent[];
}

/**
 * Test and local-development repository. Transactions are fully serialised
 * and run against a copy of the state that is swapped in only on success,
 * matching SERIALIZABLE semantics and rollback on error.
 */
export class InMemoryLicensingRepository implements LicensingRepository {
  #state: State = {
    codes: new Map(),
    templates: new Map(),
    licenses: new Map(),
    installations: new Map(),
    activations: [],
    grants: [],
    idempotency: new Map(),
    nonces: new Map(),
    audit: []
  };
  #queue: Promise<unknown> = Promise.resolve();

  transaction<T>(fn: (tx: LicensingTx) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const draft = structuredClone(this.#state);
      const result = await fn(this.#tx(draft));
      this.#state = draft;
      return result;
    };
    const next = this.#queue.then(run, run);
    this.#queue = next.catch(() => undefined);
    return next;
  }

  audit(input: AuditEventInput, at: Date): Promise<AuditEvent> {
    return this.transaction((tx) => tx.appendAudit(input, at));
  }

  /** Read-only snapshot for assertions in tests. */
  snapshot(): Readonly<State> {
    return structuredClone(this.#state);
  }

  #tx(s: State): LicensingTx {
    return {
      getCodeByHash: async (h) => [...s.codes.values()].find((c) => c.codeHash === h),
      putCode: async (r) => void s.codes.set(r.codeId, r),
      getTemplate: async (id) => s.templates.get(id),
      putTemplate: async (t) => void s.templates.set(t.templateId, t),
      getLicense: async (id) => s.licenses.get(id),
      putLicense: async (r) => void s.licenses.set(r.licenseId, r),
      getInstallation: async (licenseId, id) => s.installations.get(`${licenseId}:${id}`),
      putInstallation: async (r) => void s.installations.set(`${r.licenseId}:${r.installationId}`, r),
      countActiveInstallations: async (licenseId) =>
        [...s.installations.values()].filter((i) => i.licenseId === licenseId && i.status === "ACTIVE").length,
      putActivation: async (r) => void s.activations.push(r),
      getLatestGrant: async (licenseId, installationId) =>
        s.grants.filter((g) => g.licenseId === licenseId && g.installationId === installationId).at(-1),
      putGrant: async (r) => void s.grants.push(r),
      getIdempotency: async (scope, key) => s.idempotency.get(`${scope}:${key}`),
      putIdempotency: async (r) => void s.idempotency.set(`${r.scope}:${r.key}`, r),
      nonceSeen: async (nonce, since) => (s.nonces.get(nonce) ?? -Infinity) >= since,
      putNonce: async (nonce, at) => void s.nonces.set(nonce, at),
      appendAudit: async (input, at) => {
        const event = chainAuditEvent(s.audit.at(-1), input, newId("aud"), at);
        s.audit.push(event);
        return event;
      }
    };
  }
}
