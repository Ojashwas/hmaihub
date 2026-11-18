# API Reference

All packages are ES modules exporting TypeScript from `src/index.ts`.

## @hyperoffice/licensing-core

### Verification

| Export | Signature | Notes |
| --- | --- | --- |
| `verifyCompactJws` | `(token: string, opts: VerifyOptions) => VerifiedToken` | Throws `LicenseTokenError` |
| `evaluateGrant` | `(token: string, ctx: GrantValidationContext) => GrantEvaluation` | Never throws for token errors |
| `parseGrantClaims` | `(payload: Record<string, unknown>) => LicenseGrantClaims` | Throws `INVALID_CLAIMS` / `UNSUPPORTED_LICENSE_VERSION` |
| `snapshotFromEvaluation` | `(e: GrantEvaluation) => LicenseSnapshot` | Input for `entitlement-sdk` |
| `parseStrictJson` | `(text: string, maxDepth = 32) => unknown` | Duplicate-member detection |

`VerifyOptions = { trustedKeys: TrustedKeySet; allowedAlgorithms?: JwsAlgorithm[]; expectedType?: string }`

`GrantValidationContext = VerifyOptions & { expectedIssuer; expectedAudience; product; installationId; deviceBinding; now }`

`GrantEvaluation = { status: LicenseStatus; reason: string; claims?: LicenseGrantClaims; kid?: string }`

### Keys and signing

| Export | Signature |
| --- | --- |
| `trustedKeySetFromJwks` | `(jwks: unknown[], allowedEnvironments: KeyEnvironment[]) => TrustedKeySet` |
| `TrustedKeySet` | `get(kid)`, `kids()` |
| `encodeSigningInput` | `(header: ProtectedHeader, payload: object) => string` |
| `assembleCompactJws` | `(signingInput: string, signature: Uint8Array) => string` |
| `signWithLocalKey` | `(alg, signingInput, privateKey: KeyObject) => Uint8Array` — development/test only |

### Policies

| Export | Signature |
| --- | --- |
| `addCalendarMonthsUtc` | `(epochSeconds: number, months: number) => number` |
| `addTerm` | `(start: number, term: Term) => number` |
| `computeGraceUntil` | `(expiry: number, graceDays: number) => number` |
| `computeRenewalWindow` | `(input: RenewalInput) => { start; expiry }` |

### Activation codes

`CODE_ALPHABET`, `CODE_PREFIX`, `CODE_RANDOM_SYMBOLS`, `CODE_ENTROPY_BITS`,
`computeCheckSymbol(body)`, `hasValidCheckSymbol(bodyWithCheck)`,
`formatActivationCode(27 symbols)`, `normalizeActivationCode(input) => string | null`.

### Types and constants

`LicenseStatus`, `TokenErrorCode`, `LicenseTokenError`, `EDITIONS`, `LICENSE_MODES`,
`SUITE_PRODUCT`, `PATTERNS`, `LICENSE_TOKEN_TYPE`, `SUPPORTED_ALGORITHMS`.

Sub-path `@hyperoffice/licensing-core/test-vectors`: RFC 8032 test key and sample claims (tests only).

## @hyperoffice/licensing-client

| Export | Purpose |
| --- | --- |
| `ClockGuard(state, {wallNow, monotonicNow}, tolerance?)` | `check(signedFloor?)`, `recordTrustedServerTime(t)`, `state()` |
| `validateInstalledLicense(token, ctx, clock)` | Offline validation with clock checks |
| `computeDeviceFingerprint(salt, signals)` | `sha256:<base64url>` |
| `computeSignalHashes(salt, signals)` / `matchDevice(recorded, current, threshold?)` | Weighted binding |
| `GrantStore(store, validate)` | `read()`, `install(token, now)` → `InstallResult` |
| `MemorySecureStore` | Test-only `SecureStore` |
| `createInstallationId()` | `ins_` + 26 symbols |
| `prepareActivation(input)` / `prepareRenewal(input)` | Request body + idempotency key |
| `applyRenewalResponse(store, grant, now)` | Installs replacement grant |
| `buildDiagnostics(evaluation, record)` | Privacy-safe summary |

## @hyperoffice/entitlement-sdk

| Export | Purpose |
| --- | --- |
| `createEntitlements(getSnapshot)` | Returns `{ require(cap): EntitlementDecision; assert(cap): void }` |
| `EntitlementError` | Thrown by `assert` |
| `CAPABILITIES`, `CAPABILITY_MAP` | Capability catalogue |
| `PRODUCTS`, `isProductLicensed` | Product map |

## @hyperoffice/licensing-service

| Export | Purpose |
| --- | --- |
| `issueCodes(deps, IssueCodesCommand)` | → `IssuedCode[]` |
| `activateLicense(deps, ActivationCommand)` | → `ActivationResponse` |
| `renewLicense(deps, RenewalCommand)` | → `RenewalResponse` |
| `LicensingError` | `publicCode`, `internalReason`, `httpStatus`, `toPublic()` |
| `DEFAULT_POLICY`, `LicensingConfig` | Configuration |
| `InMemoryLicensingRepository`, `LicensingRepository`, `LicensingTx` | Persistence port |
| `LocalDevelopmentSigner`, `GrantSigner` | Signing port |
| `FixedWindowRateLimiter`, `hashActivationCode`, `generateActivationCode` | Infrastructure |
| `chainAuditEvent`, `verifyAuditChain` | Audit |

`LicensingDeps = { repo, signer, pepper: Uint8Array, limiter, config }`.

## @hyperoffice/format-detector

`detectFormat(bytes, { fileName?, limits? }) => DetectionResult`,
`readCentralDirectory`, `readEntry`, `DESKTOP_LIMITS`, `SERVER_LIMITS`,
`PackageSecurityError`, `FILE_MEDIA_TYPES`, `writeZip`, `MINIMAL_PACKAGES`, `MINIMAL_MSPDI`.

## Licensing REST API (contract draft, not served)

Source: [services/licensing/openapi/licensing.v1.yaml](../services/licensing/openapi/licensing.v1.yaml).

| Method | Path | Implemented as |
| --- | --- | --- |
| POST | `/v1/activations` (header `Idempotency-Key`) | `activateLicense` |
| POST | `/v1/licenses/{license_id}/renewals` (header `Idempotency-Key`) | `renewLicense` |
| POST | `/v1/installations/{installation_id}/deactivation` | Not implemented |
| GET | `/.well-known/hyperoffice-license-keys.json` | Not implemented |
| GET | `/health/live`, `/health/ready` | Not implemented |

### Error body

```json
{ "error": "ACTIVATION_FAILED", "message": "…", "support_reference": "HSR-…", "retry_after_seconds": 120 }
```

| `error` | HTTP |
| --- | --- |
| `INVALID_REQUEST` | 400 |
| `APPROVAL_REQUIRED` | 403 |
| `IDEMPOTENCY_CONFLICT`, `REPLAY_DETECTED` | 409 |
| `ACTIVATION_FAILED`, `RENEWAL_FAILED` | 422 |
| `RATE_LIMITED` | 429 (+ `Retry-After`) |

Request/response schemas: [schemas/licensing/](../schemas/licensing/).
