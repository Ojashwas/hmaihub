# Technical Design Document (TDD)

| Item | Value |
| --- | --- |
| Version | 0.1 |
| Date | 2026-11-18 |
| Baseline | Commit `392d896` |
| Scope | All code present in the repository |

## 1. Repository layout

```
hyperoffice/
├── packages/
│   ├── licensing-core/        shared licence primitives (no runtime deps)
│   ├── licensing-client/      client validation, storage, binding, clock guard
│   └── entitlement-sdk/       central feature gate
├── services/licensing/        licensing business logic, OpenAPI, SQL migration
├── tools/
│   ├── format-detector/       L0 detection, bounded ZIP reader, fixtures
│   └── development-license-issuer/
├── schemas/{hyperoffice,licensing}/   JSON Schema 2020-12 contracts
├── compatibility/{manifests,fixtures}/
├── docs/  research/rea/  third_party/
└── package.json, pnpm-workspace.yaml, turbo.json, tsconfig.json, eslint.config.js
```

Conventions: ES modules; erasable TypeScript only (no enums, namespaces,
parameter properties); `.ts` import specifiers; packages export `src/index.ts`
directly; tests in `tests/**/*.test.ts` run by `node --test`.

## 2. Format detector (`tools/format-detector`)

### 2.1 Algorithm

```
detectFormat(bytes, {fileName?, limits = DESKTOP_LIMITS})
  if PK\x03\x04 | PK\x05\x06  → readCentralDirectory → detectOpc
  elif D0 CF 11 E0 A1 B1 1A E1 → ole-compound (+ LEGACY_OR_ENCRYPTED_CONTAINER)
  elif "%PDF-"                 → pdf
  elif "{\rtf"                 → rtf
  else sniff first 64 KiB as XML → mspdi if root <Project> in MSPDI namespace
  if fileName: compare extension → EXTENSION_MISMATCH
```

`detectOpc`: read `[Content_Types].xml` overrides, follow the `officeDocument`
relationship in `_rels/.rels` (internal targets only), map the main part's
content type to a format; fall back to scanning overrides; flag macros and
encrypted entries.

### 2.2 Central directory reader

1. Locate EOCD within the last 65,557 bytes.
2. Reject multi-disk and ZIP64 (`0xFFFF`/`0xFFFFFFFF` markers).
3. Enforce `maxEntries`, CD bounds.
4. Per entry: name validation (no `..`, `.`, leading `/`, drive letter, `\`, NUL),
   case-insensitive duplicate detection, per-entry size, compression ratio (>200:1
   for parts >1 MiB), cumulative size, local header offset bound.

`readEntry` reads the local header, refuses parts larger than
`maxInspectedPartBytes`, inflates with `maxOutputLength = declared + 1`, and
requires the output length to equal the declared size.

### 2.3 Limits and errors

`DESKTOP_LIMITS` / `SERVER_LIMITS` in `src/limits.ts`. All failures throw
`PackageSecurityError(code)`; property tests assert no other exception type escapes.

## 3. licensing-core

### 3.1 Token format

Compact JWS. Protected header exactly `{typ: "HYPEROFFICE-LICENSE+jws", alg, kid, ver: 1}`.
Payload per [license-grant.schema.json](../schemas/licensing/license-grant.schema.json).

### 3.2 Verification (`verifyCompactJws`)

| Step | Check | Error code |
| --- | --- | --- |
| 1 | Length ≤ 16 KiB, three non-empty segments | `MALFORMED_TOKEN` |
| 2 | Canonical unpadded base64url | `INVALID_BASE64URL` |
| 3 | Fatal UTF-8 decode; strict JSON; duplicate members | `INVALID_JSON`, `DUPLICATE_JSON_MEMBER` |
| 4 | No `crit`; only `typ/alg/kid/ver` | `UNKNOWN_CRITICAL_HEADER`, `UNSUPPORTED_HEADER_PARAMETER` |
| 5 | `typ` match; `alg` in allowlist; `ver` supported | `UNSUPPORTED_TYPE`, `ALGORITHM_NOT_ALLOWED`, `UNSUPPORTED_LICENSE_VERSION` |
| 6 | `kid` in trust store; alg equals key alg and key type | `UNKNOWN_KEY_ID`, `KEY_ALGORITHM_MISMATCH` |
| 7 | Key not `compromised` | `KEY_NOT_USABLE` |
| 8 | 64-byte signature; `crypto.verify` (Ed25519, or ECDSA P-256 IEEE-P1363) | `INVALID_SIGNATURE` |
| 9 | Payload decoded only now | `INVALID_CLAIMS` |

### 3.3 Claims (`parseGrantClaims`)

Known claims only; ID patterns (`lic_`, `cus_`, `ord_`, `ins_`); editions and
modes from fixed lists; products/features unique and pattern-checked; integers
are safe integers; `nbf ≥ iat − 300`, `exp > nbf`, `grace_until ≥ exp`;
`policy_version ∈ {1}`.

### 3.4 Evaluation (`evaluateGrant`)

Order: token/claims → issuer → audience → installation + device binding →
product (or suite) → `nbf` → `exp` → `grace_until`. Returns
`{status, reason, claims?, kid?}`; never throws for token errors.

### 3.5 Strict JSON parser

Recursive descent over RFC 8259; null-prototype objects (no `__proto__`
pollution); duplicate detection after unescaping; depth limit 32; rejects
trailing data, control characters, invalid escapes.

### 3.6 Trust store

`trustedKeySetFromJwks(jwks, allowedEnvironments)` rejects private members
(`d`, `p`, `q`), unknown statuses, environments not allowed by the build,
mismatched kty/crv/alg, duplicate kids.

### 3.7 Policies

`addCalendarMonthsUtc` (UTC, clamps day to month length, preserves time of
day); `addTerm` (months or days); `computeGraceUntil`; `computeRenewalWindow`
with five start policies (default `max-current-expiry-or-now`).

### 3.8 Activation code format

Alphabet `23456789ABCDEFGHJKMNPQRSTVWXYZ`, 27 random symbols, Luhn mod 30 check
symbol, `HO1-` + 7×4 groups. `normalizeActivationCode` canonicalises or returns `null`.

## 4. licensing-client

| Module | Design |
| --- | --- |
| `ClockGuard` | State `{lastTrustedServerTime, highestObservedTime}`; tolerance 600 s; checks floor, signed `iat`, monotonic session drift; reported time = `max(wall, floor)` |
| `validateInstalledLicense` | `evaluateGrant` with guarded time; downgrades only time-dependent statuses to `CLOCK_TAMPER_SUSPECTED` |
| Device binding | Allowlisted signals and weights (`machine_id` 4, `os_install_id` 3, `system_volume_id` 2, `board_serial` 2, `cpu_model` 1, `os_family` 1); ≥ 2 signals; length-prefixed salted SHA-256; match threshold 0.6 |
| `GrantStore` | Validate → reject same/lower `license_version` for same licence → single atomic `write` → keep superseded; failure returns `STORAGE_FAILED` without touching current |
| Requests | `prepareActivation`/`prepareRenewal`: normalised code, 128-bit nonce, UUID idempotency key, ISO client time (informational) |
| Diagnostics | Status, reason, kid, licence ID/version, edition, products, feature count, expiry, grant hash only |

## 5. entitlement-sdk

`createEntitlements(getSnapshot)` → `{require, assert}`.

Decision order: unknown capability → `NOT_ENTITLED/UNKNOWN_CAPABILITY`;
`data-access` → `ALLOWED`; no snapshot or snapshot throws →
`LICENSING_COMPONENT_UNAVAILABLE`; status not `ALLOWED`/`GRACE_PERIOD` → that
status; product not licensed (suite counts as all) → `NOT_ENTITLED`; none of
`anyOf` features → `NOT_ENTITLED`; else allowed with the snapshot status.

## 6. Licensing service

### 6.1 Structure

```
src/domain/          types, activation-code generator, ids, audit-event
src/application/     config, errors, requests, grant-issuer, activate-license, renew-license, issue-codes
src/infrastructure/  database (port + in-memory), hashing, signing, rate-limiting
```

### 6.2 Activation sequence

1. Validate body and `Idempotency-Key` → `INVALID_REQUEST`.
2. Rate limit IP, installation, fingerprint (hit); code hash (peek, failures only).
3. Normalise code; `code_hash = HMAC-SHA-256(pepper ≥ 256 bit, code)`.
4. Transaction (serialisable):
   1. Idempotency lookup → same response or `IDEMPOTENCY_CONFLICT`.
   2. Nonce seen within 900 s → `REPLAY_DETECTED`.
   3. Code exists, kind `activation`, redeemable status, `validFrom`, `redeemBy`, product.
   4. Existing licence must be `ACTIVE`; same installation with same fingerprint reuses its slot; different fingerprint → reset required.
   5. Enforce code `maxInstallations` and licence `limits.installations`.
   6. Create licence on first activation (term from template or default, grace from config).
   7. Sign grant (`nbf = max(licence nbf, now)`); persist code, licence, installation, activation, grant, idempotency, nonce, audit.
5. On `ACTIVATION_FAILED`: count failure for the code hash; audit failure with internal reason.

### 6.3 Renewal sequence

Verify presented grant (signature, issuer, audience, path licence ID,
installation, fingerprint; expiry ignored) → transaction: idempotency, nonce,
licence active, installation active, code unredeemed/in date/customer and licence
binding/kind/products/edition → compute window or merge feature → increment
`license_version` → sign → persist with `supersedesJti` → audit with before/after.

### 6.4 Errors

`LicensingError{publicCode, internalReason, httpStatus, supportReference, retryAfterSeconds}`.
Only `toPublic()` crosses the boundary. Mapping: `INVALID_REQUEST` 400,
`ACTIVATION_FAILED`/`RENEWAL_FAILED` 422, `IDEMPOTENCY_CONFLICT`/`REPLAY_DETECTED` 409,
`APPROVAL_REQUIRED` 403, `RATE_LIMITED` 429.

### 6.5 Audit chain

Event body (sequence, prevHash, actor, action, subject, result, correlationId,
reason, changes) is canonicalised (sorted keys) and hashed with SHA-256.
`verifyAuditChain` detects edits, deletions, and reordering. Fields whose names
suggest secrets (`token`, `grant`, `secret`, `pepper`, `private`, `fingerprint`,
`code` except `codeId(s)`) are refused; control characters are stripped.

### 6.6 Transactions

`InMemoryLicensingRepository` serialises transactions through a promise queue
and applies a `structuredClone` draft only on success — equivalent to
SERIALIZABLE isolation with full rollback. The PostgreSQL adapter must use
`SERIALIZABLE` with retry on serialisation failure.

### 6.7 Configuration

`LicensingConfig`: issuer, audience, public key set URL, default term
(6 months), grace (14 days), renewal policy, replay window (900 s), bulk approval
threshold (50), verification keys, rate limits (IP 10/15 min, code failures
5/h, installation 10/h, fingerprint 10/h).

## 7. Data model

Tables: `customer`, `order`, `entitlement_template`, `activation_code`,
`license`, `installation` (PK licence + installation), `activation`,
`license_grant` (supersession, kid index), `revocation`, `idempotency_record`,
`request_nonce`, `signing_key` (metadata only), `audit_event` (append-only).
See [migrations/0001_initial.sql](../services/licensing/migrations/0001_initial.sql) — not yet executed.

## 8. Contracts

JSON Schemas in `schemas/licensing/` are validated against real outputs in
`services/licensing/tests/contract/schemas.test.ts` (Ajv strict mode).
OpenAPI: `services/licensing/openapi/licensing.v1.yaml`.

## 9. Testing design

Unit tests per module, property tests (fast-check) for parsers, codes, dates,
entitlements, and detector robustness; contract tests for schemas; concurrency
tests with `Promise.allSettled`; deterministic RFC 8032 vectors. Results: [Test Report](test-report.md).

## 10. Known technical limitations

- No HTTP server, PostgreSQL adapter, Key Vault signer, or platform secure stores.
- In-memory rate limiter is per process.
- Format detection does not parse OLE contents, ZIP64, or validate XML beyond detection.
- Renewal-path failures before the transaction (malformed code, invalid presented grant) are not written to the audit chain.
