import type { RenewalStartPolicy, Term, TrustedKeySet } from "@hyperoffice/licensing-core";
import type { RateLimitRule } from "../infrastructure/rate-limiting/fixed-window.ts";

/** Server-side commercial and security policy. Nothing here is compiled into clients. */
export interface LicensingConfig {
  issuer: string;
  audience: string;
  publicKeySetUrl: string;
  defaultTerm: Term;
  graceDays: number;
  renewalPolicy: RenewalStartPolicy;
  replayWindowSeconds: number;
  bulkApprovalThreshold: number;
  /** Keys this service accepts when verifying grants presented for renewal. */
  verificationKeys: TrustedKeySet;
  rateLimits: {
    perIp: RateLimitRule;
    perCodeFailures: RateLimitRule;
    perInstallation: RateLimitRule;
    perFingerprint: RateLimitRule;
  };
}

export const DEFAULT_POLICY = {
  defaultTerm: { unit: "months", length: 6 },
  graceDays: 14,
  renewalPolicy: "max-current-expiry-or-now",
  replayWindowSeconds: 900,
  bulkApprovalThreshold: 50,
  rateLimits: {
    perIp: { limit: 10, windowSeconds: 900 },
    perCodeFailures: { limit: 5, windowSeconds: 3600 },
    perInstallation: { limit: 10, windowSeconds: 3600 },
    perFingerprint: { limit: 10, windowSeconds: 3600 }
  }
} as const satisfies Omit<LicensingConfig, "issuer" | "audience" | "publicKeySetUrl" | "verificationKeys">;
