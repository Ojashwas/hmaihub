import type { Edition, LicenseLimits, LicenseMode, RenewalStartPolicy, Term } from "@hyperoffice/licensing-core";

export type CodeStatus = "GENERATED" | "ASSIGNED" | "REDEEMED" | "SUSPENDED" | "REVOKED" | "EXPIRED" | "REPLACED";

/** Renewal Code extends term; Feature Code adds entitlements. Extension Packages are a separate concept. */
export type CodeKind = "activation" | "renewal" | "feature";

export interface EntitlementTemplate {
  templateId: string;
  kind: CodeKind;
  edition: Edition;
  licenseMode: LicenseMode;
  products: string[];
  features: string[];
  limits: LicenseLimits;
  term?: Term;
  renewalPolicy?: RenewalStartPolicy;
  /** Contractual start; when absent the term starts at successful activation. */
  contractStart?: number;
  /** End date for co-terminated enterprise renewals. */
  coTerminateAt?: number;
}

export interface ActivationCodeRecord {
  codeId: string;
  codeHash: string;
  templateId: string;
  status: CodeStatus;
  issuedAt: number;
  validFrom?: number;
  redeemBy: number;
  maxInstallations: number;
  activationCount: number;
  channel: string;
  reseller?: string;
  externalOrderId?: string;
  orderId?: string;
  customerId?: string;
  licenseId?: string;
  replacedBy?: string;
  createdBy: string;
  fraudFlags: string[];
}

export type LicenseRecordStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface LicenseRecord {
  licenseId: string;
  customerId: string;
  orderId?: string;
  edition: Edition;
  licenseMode: LicenseMode;
  products: string[];
  features: string[];
  limits: LicenseLimits;
  nbf: number;
  exp: number;
  graceUntil: number;
  activatedAt: number;
  licenseVersion: number;
  status: LicenseRecordStatus;
}

export interface InstallationRecord {
  installationId: string;
  licenseId: string;
  deviceFingerprint: string;
  status: "ACTIVE" | "DEACTIVATED";
  firstActivatedAt: number;
  lastActivatedAt: number;
}

export interface ActivationRecord {
  activationId: string;
  licenseId: string;
  installationId: string;
  codeId: string;
  createdAt: number;
  appVersion: string;
  platform: string;
}

export interface GrantRecord {
  jti: string;
  licenseId: string;
  installationId: string;
  licenseVersion: number;
  kid: string;
  issuedAt: number;
  exp: number;
  supersedesJti?: string;
}

export interface IdempotencyRecord {
  scope: string;
  key: string;
  requestHash: string;
  response: unknown;
  createdAt: number;
}
