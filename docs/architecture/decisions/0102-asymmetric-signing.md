# ADR-0102: Asymmetric JWS signing

Status: Accepted

## Context

Clients must verify that a grant was issued by HyperOffice without holding any
secret. Hashes (SHA-256), HMACs, checksums, or encrypted dates in the client do
not provide this property.

## Decision

- Compact JWS with `typ: HYPEROFFICE-LICENSE+jws`, `ver: 1`.
- Algorithm allowlist: `EdDSA` (Ed25519) preferred, `ES256` (P-256, IEEE P1363
  signature encoding) as fallback. RS256 only if a target platform supports
  neither; not currently implemented.
- Verification rejects `alg: none`, any non-allowlisted algorithm, algorithm/key
  mismatch, `crit`, any header parameter other than `typ`/`alg`/`kid`/`ver`
  (blocks `jku`, `jwk`, `x5u`, `x5c` key injection), unknown `kid`, compromised
  keys, non-canonical base64url, invalid UTF-8, duplicate JSON members, and
  unknown claims.
- The payload is parsed only after the signature verifies.
- Signatures use `node:crypto` (OpenSSL); no custom primitives.

## Ed25519 availability

Azure Key Vault Premium/Managed HSM support for Ed25519 signing must be
confirmed against current Azure documentation before Phase L5. If it is not
available in the selected key service, production uses ES256 (supported by Key
Vault `EC-HSM` P-256 keys) — the client verifier already accepts both.

## Consequences

- Private keys never exist in clients; grants are public, integrity-protected
  authorisation documents, not encrypted containers.
- Deterministic Ed25519 test vectors use the RFC 8032 test key in a `test`-only
  trust environment.
