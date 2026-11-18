# HyperOffice licensing service

Status: **experimental** · Owner: `@hyperoffice/security`

Issues activation codes, activates installations, applies renewals and feature
codes, and signs licence grants. It processes licensing metadata only. It is
logically and operationally separate from document processing.

## Implemented (first iteration, development keys only)

| Area | Location | Notes |
| --- | --- | --- |
| Code generation | [src/domain/activation-code.ts](src/domain/activation-code.ts) | OS CSPRNG, rejection sampling, `HO1` format, Luhn mod 30 check symbol |
| Code issuance | [src/application/issue-codes.ts](src/application/issue-codes.ts) | Stores HMAC-SHA-256 lookup hash only; dual approval above threshold |
| Activation | [src/application/activate-license.ts](src/application/activate-license.ts) | Serializable transaction, idempotency, nonce replay, rate limits, generic errors, audit |
| Renewal / feature codes | [src/application/renew-license.ts](src/application/renew-license.ts) | Verifies presented grant, single-use consumption, supersession |
| Audit | [src/domain/audit-event.ts](src/domain/audit-event.ts) | SHA-256 hash chain; refuses secret-looking fields; strips control characters |
| Signing | [src/infrastructure/signing/signer.ts](src/infrastructure/signing/signer.ts) | `GrantSigner` port; `LocalDevelopmentSigner` refuses staging/production |
| Persistence | [src/infrastructure/database/](src/infrastructure/database/) | Repository port + in-memory serializable implementation for tests |
| Contract | [openapi/licensing.v1.yaml](openapi/licensing.v1.yaml), [migrations/0001_initial.sql](migrations/0001_initial.sql) | Draft; SQL not yet executed |

## Not implemented

- HTTP adapter, request-size limits, CORS/CSRF, Entra ID admin authentication.
- PostgreSQL repository (the migration has not been run against a database).
- Azure Key Vault / Managed HSM signer and pepper retrieval (Phase L5).
- Deactivation, support reset, revocation, offline licence signing, key rotation workflow, workers.
- Billing adapters and webhooks (blocked until L0–L6 security review).

Do not deploy this service or issue production codes. See
[docs/licensing/implementation-backlog.md](../../docs/licensing/implementation-backlog.md).

## Tests

`pnpm --filter @hyperoffice/licensing-service test` — unit (activation, renewal,
codes, rate limits, audit, rotation) and contract (JSON Schema) suites.
