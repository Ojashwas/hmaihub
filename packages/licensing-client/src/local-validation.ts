import { evaluateGrant, type GrantEvaluation, type GrantValidationContext } from "@hyperoffice/licensing-core";
import type { ClockGuard } from "./clock-protection.ts";

export type LocalLicenseContext = Omit<GrantValidationContext, "now">;

const CLOCK_SENSITIVE = new Set(["ALLOWED", "GRACE_PERIOD", "NOT_YET_VALID", "EXPIRED"]);

/**
 * Offline validation run at launch and before licensed feature use.
 * Clock rollback downgrades a usable result to CLOCK_TAMPER_SUSPECTED;
 * signature and binding failures are never masked.
 */
export function validateInstalledLicense(token: string, ctx: LocalLicenseContext, clock: ClockGuard): GrantEvaluation {
  const preliminary = clock.check();
  const evaluation = evaluateGrant(token, { ...ctx, now: preliminary.now });
  if (!CLOCK_SENSITIVE.has(evaluation.status) || !evaluation.claims) return evaluation;

  const checked = preliminary.ok ? clock.check(evaluation.claims.iat) : preliminary;
  if (!checked.ok) {
    return { ...evaluation, status: "CLOCK_TAMPER_SUSPECTED", reason: checked.issue ?? "CLOCK_TAMPER_SUSPECTED" };
  }
  return evaluation;
}
