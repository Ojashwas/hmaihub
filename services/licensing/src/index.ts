export {
  activateLicense,
  type ActivationCommand,
  type ActivationResponse,
  type LicensingDeps
} from "./application/activate-license.ts";
export { renewLicense, type RenewalCommand, type RenewalResponse } from "./application/renew-license.ts";
export { issueCodes, type IssueCodesCommand, type IssuedCode } from "./application/issue-codes.ts";
export { DEFAULT_POLICY, type LicensingConfig } from "./application/config.ts";
export { LicensingError, type PublicErrorCode } from "./application/errors.ts";
export { generateActivationCode } from "./domain/activation-code.ts";
export { chainAuditEvent, verifyAuditChain, type AuditEvent } from "./domain/audit-event.ts";
export type * from "./domain/types.ts";
export { InMemoryLicensingRepository } from "./infrastructure/database/in-memory-repository.ts";
export type { LicensingRepository, LicensingTx } from "./infrastructure/database/repository.ts";
export { hashActivationCode } from "./infrastructure/hashing/code-hash.ts";
export { FixedWindowRateLimiter } from "./infrastructure/rate-limiting/fixed-window.ts";
export { LocalDevelopmentSigner, type GrantSigner } from "./infrastructure/signing/signer.ts";
