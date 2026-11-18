import type { GrantEvaluation } from "@hyperoffice/licensing-core";
import type { InstalledLicenseRecord } from "./secure-storage.ts";

export interface LicenseDiagnostics {
  status: string;
  reason: string;
  key_id?: string;
  license_id?: string;
  license_version?: number;
  edition?: string;
  products?: readonly string[];
  feature_count?: number;
  expires_at?: string;
  grace_until?: string;
  grant_hash?: string;
}

/**
 * Privacy-safe summary for support. Excludes customer IDs, device signals,
 * fingerprints, the token itself, and any document information.
 */
export function buildDiagnostics(
  evaluation: GrantEvaluation,
  record: InstalledLicenseRecord | null
): LicenseDiagnostics {
  const out: LicenseDiagnostics = { status: evaluation.status, reason: evaluation.reason };
  if (evaluation.kid) out.key_id = evaluation.kid;
  const c = evaluation.claims;
  if (c) {
    out.license_id = c.license_id;
    out.license_version = c.license_version;
    out.edition = c.edition;
    out.products = c.products;
    out.feature_count = c.features.length;
    out.expires_at = new Date(c.exp * 1000).toISOString();
    out.grace_until = new Date(c.grace_until * 1000).toISOString();
  }
  if (record) out.grant_hash = record.current.tokenHash;
  return out;
}
