# Test Report

| Item | Value |
| --- | --- |
| Date executed | 2026-11-18 |
| Commit | `392d896` (branch `architecture/hyperoffice-foundation`) |
| Environment | Windows, Node.js v26.13.0, pnpm 12.21.0, TypeScript 5.9.3 |
| Command | `pnpm test` (Turborepo) |
| Result | **6/6 tasks successful, 148 tests, 148 passed, 0 failed** |

## Results by package

| Package | Tests | Passed | Failed | Content |
| --- | --- | --- | --- | --- |
| `@hyperoffice/licensing-core` | 54 | 54 | 0 | JWS rejection matrix, RFC 8032 vector, test vectors, trust store, grant evaluation boundaries, calendar policies (incl. property tests), activation code format, strict JSON |
| `@hyperoffice/licensing-service` | 33 | 33 | 0 | Activation, enumeration-uniform errors, installation limits, idempotency, replay, concurrent redemption, re-activation, contract start, Key Vault failure rollback, rate limits, audit chain and secrecy, key rotation, renewal, feature codes, code generation, bulk approval, JSON Schema contracts |
| `@hyperoffice/format-detector` | 27 | 27 | 0 | Fixture detection, spoofing, hostile packages, fuzz-style property tests, capability manifests |
| `@hyperoffice/licensing-client` | 20 | 20 | 0 | Clock guard, offline validation, device binding, grant store rollback/failure, request preparation, diagnostics |
| `@hyperoffice/entitlement-sdk` | 9 | 9 | 0 | Gates, suite coverage, grace, fail-closed matrix, data-access invariant |
| `@hyperoffice/development-license-issuer` | 5 | 5 | 0 | Issue/verify, key reuse, production refusal, gitignore |
| **Total** | **148** | **148** | **0** | |

## Other quality gates (same date)

| Gate | Command | Result |
| --- | --- | --- |
| Formatting | `pnpm format:check` | Pass |
| Lint | `pnpm lint` | Pass, 0 problems |
| Type check (strict) | `pnpm typecheck` | Pass, 0 errors |
| Build | `pnpm build` | Pass (0 tasks; nothing to compile) |
| End-to-end | `pnpm test:e2e` | **Fail (expected)** — no UI exists |
| Rust | `cargo build/test --workspace` | **Not run** — toolchain not installed, no crates |
| Private-key scan | `git grep` for PEM private keys | Pass, none found |

## Not executed

- CI workflows on GitHub (repository not pushed).
- CodeQL, dependency review, `pnpm audit` (defined in `security.yml`, run in CI only).
- PostgreSQL migration, HTTP contract tests, load/performance tests.
- Accessibility, visual, interoperability, and Microsoft Office round-trip tests.
- Penetration testing.

## Coverage gaps

See [licensing/security-test-plan.md](licensing/security-test-plan.md) for the
item-by-item status of required licensing tests, and
[architecture/gap-analysis.md](architecture/gap-analysis.md) for milestone gaps.

## How to reproduce

```powershell
pnpm install
pnpm check
```
