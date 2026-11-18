# @hyperoffice/licensing-core

Status: **experimental** · Owner: `@hyperoffice/security`

Shared, dependency-free licensing primitives used by the licensing service and
by HyperOffice clients.

## Public API (`src/index.ts`)

| Area | Exports |
| --- | --- |
| Token schema | `LicenseGrantClaims`, `parseGrantClaims`, `EDITIONS`, `LICENSE_MODES`, `PATTERNS` |
| Validation | `verifyCompactJws`, `evaluateGrant`, `snapshotFromEvaluation`, `parseStrictJson` |
| Trust store | `TrustedKeySet`, `trustedKeySetFromJwks` (rejects private JWK members and untrusted environments) |
| Policies | `addCalendarMonthsUtc`, `addTerm`, `computeGraceUntil`, `computeRenewalWindow` |
| Activation code format | `normalizeActivationCode`, `formatActivationCode`, `computeCheckSymbol`, `CODE_ALPHABET` |
| Errors | `LicenseStatus`, `LicenseTokenError`, `TokenErrorCode` |

Code generation is intentionally **not** in this package; it lives in
`services/licensing` so that client builds never contain a commercial code
generator.

## Security properties

- Algorithm allowlist (`EdDSA`, `ES256`); `none`, HMAC, and unknown algorithms are rejected.
- `typ` must be `HYPEROFFICE-LICENSE+jws`; `crit` and any header parameter other than
  `typ`, `alg`, `kid`, `ver` are rejected (prevents `jku`/`jwk`/`x5u` key injection).
- The key is selected by `kid` from an embedded trust store only; algorithm/key-type mismatches are rejected.
- Strict base64url (canonical, unpadded), strict UTF-8, strict JSON with duplicate-member detection.
- The payload is parsed only after the signature verifies.
- Signatures use `node:crypto` (OpenSSL). No custom cryptography.

## Test vectors

[test-vectors/](test-vectors/) contains public keys and signed tokens for
EdDSA (RFC 8032 test key, deterministic) and ES256. Regenerate with
`node packages/licensing-core/test-vectors/generate.ts`. These keys are
`environment: "test"` and cannot be loaded by a store that only trusts
`production`.

## Tests

`pnpm --filter @hyperoffice/licensing-core test`
