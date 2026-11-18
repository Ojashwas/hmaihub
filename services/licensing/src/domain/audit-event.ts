import { createHash } from "node:crypto";

export interface AuditEventInput {
  actor: string;
  action: string;
  subject: string;
  result: "SUCCESS" | "FAILURE" | "DENIED";
  correlationId: string;
  reason?: string;
  /** Before/after values for administrative changes. Never secrets or plaintext codes. */
  changes?: { before?: unknown; after?: unknown };
}

export interface AuditEvent extends AuditEventInput {
  eventId: string;
  at: string;
  sequence: number;
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH = `sha256:${"0".repeat(43)}`;

const FORBIDDEN_KEYS = /code$|^code|token|grant|private|secret|pepper|fingerprint/i;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertNoSecrets(value: unknown, path = ""): void {
  if (!value || typeof value !== "object") return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.test(k) && !/^code_?ids?$/i.test(k))
      throw new Error(`Audit field ${path}${k} may contain secret material`);
    assertNoSecrets(v, `${path}${k}.`);
  }
}

/** Single-line, control-character-free text to prevent log injection. */
// eslint-disable-next-line no-control-regex -- stripping control characters is the purpose
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 512);

/** Appends to a SHA-256 hash chain so deletion or modification of earlier events is detectable. */
export function chainAuditEvent(
  prev: AuditEvent | undefined,
  input: AuditEventInput,
  eventId: string,
  at: Date
): AuditEvent {
  assertNoSecrets(input.changes);
  const body = {
    eventId,
    at: at.toISOString(),
    sequence: prev ? prev.sequence + 1 : 1,
    prevHash: prev ? prev.hash : GENESIS_HASH,
    actor: clean(input.actor),
    action: clean(input.action),
    subject: clean(input.subject),
    result: input.result,
    correlationId: clean(input.correlationId),
    ...(input.reason === undefined ? {} : { reason: clean(input.reason) }),
    ...(input.changes === undefined ? {} : { changes: input.changes })
  };
  return { ...body, hash: `sha256:${createHash("sha256").update(canonical(body)).digest("base64url")}` };
}

export function verifyAuditChain(events: readonly AuditEvent[]): { valid: boolean; brokenAt?: number } {
  let prevHash = GENESIS_HASH;
  for (const [i, e] of events.entries()) {
    const { hash, ...body } = e;
    const expected = `sha256:${createHash("sha256").update(canonical(body)).digest("base64url")}`;
    if (e.prevHash !== prevHash || e.sequence !== i + 1 || hash !== expected) return { valid: false, brokenAt: i };
    prevHash = hash;
  }
  return { valid: true };
}
