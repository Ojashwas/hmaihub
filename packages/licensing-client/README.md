# @hyperoffice/licensing-client

Status: **experimental** · Owner: `@hyperoffice/security`

Client-side licensing for HyperOffice desktop and web shells.

## Public API (`src/index.ts`)

| Module | Purpose |
| --- | --- |
| `activation` | `createInstallationId`, `prepareActivation` (normalised code, 128-bit nonce, idempotency key) |
| `local-validation` | `validateInstalledLicense`: offline signature, claims, binding, time, and clock checks |
| `clock-protection` | `ClockGuard`: highest-observed time, trusted server time, signed `iat` floor, in-session monotonic check |
| `device-binding` | `computeDeviceFingerprint`, `computeSignalHashes`, `matchDevice` (weighted, allowlisted signals) |
| `secure-storage` | `SecureStore` interface, `MemorySecureStore` (tests only), `GrantStore` (validate-then-write, no version rollback) |
| `renewal` | `prepareRenewal`, `applyRenewalResponse` |
| `diagnostics` | `buildDiagnostics`: privacy-safe support summary |

## Not yet implemented

- Platform `SecureStore` adapters (Windows DPAPI, macOS Keychain, Linux Secret Service).
  These need native bindings and are Phase L3. `MemorySecureStore` provides **no**
  protection and must not ship in product builds.
- HTTP transport for activation and renewal (the service endpoint does not exist yet).
- Signed offline support-response for disconnected enterprise clock recovery.

Design: [docs/licensing/local-verification.md](../../docs/licensing/local-verification.md),
[docs/licensing/clock-rollback.md](../../docs/licensing/clock-rollback.md).

## Tests

`pnpm --filter @hyperoffice/licensing-client test`
