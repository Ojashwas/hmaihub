# Licensing threat model (STRIDE)

Status: draft for security review · Scope: activation, renewal, grants, client
validation, code issuance, key management, extension package signing.

## Assets

| Asset | Sensitivity |
| --- | --- |
| Production licence signing private key | Critical: forgery of any grant |
| Code-hash HMAC pepper | High: enables offline guessing against a leaked database |
| Unredeemed activation codes | High: equivalent to money |
| Licensing database (licences, installations, audit) | High: commercial and personal data |
| Installed grant + trusted-time state on clients | Medium: tampering enables misuse on one machine |
| Extension publisher keys | Critical for code execution integrity |
| Customer documents | Out of scope **by design**: never sent to the licensing service |

## Trust boundaries

1. Client device ↔ Internet ↔ Front Door/WAF ↔ licensing API.
2. Licensing API ↔ PostgreSQL (private endpoint).
3. Licensing API ↔ Key Vault / Managed HSM (managed identity, private endpoint).
4. Admin portal (Entra ID, MFA, Conditional Access) ↔ admin API.
5. Billing provider webhooks ↔ billing adapter.
6. Extension package ↔ extension host.

## Entry points

`POST /v1/activations`, `POST /v1/licenses/{id}/renewals`, deactivation,
public key set, admin API, billing webhooks, offline request/response files,
local grant store, extension installer.

## STRIDE analysis

| Threat | Example | Controls | Residual risk |
| --- | --- | --- | --- |
| **S**poofing | Forged grant | Asymmetric JWS; embedded trust store; kid allowlist; header allowlist blocks `jku`/`jwk`/`x5u` | Key compromise (see key-compromise response) |
| S | Forged webhook “payment succeeded” | Provider signature, timestamp tolerance, replay store, idempotent event IDs | Provider account compromise |
| S | Admin impersonation | Entra ID, MFA, Conditional Access, CSRF protection | Phished admin with MFA fatigue |
| **T**ampering | Edit `exp` in grant | Signature over payload; payload parsed only after verification | None known |
| T | Algorithm confusion (`alg: none`, HS256 with public key) | Allowlist; key-type/alg binding; no symmetric algorithms accepted | None known |
| T | JSON parser ambiguity (duplicate `exp`) | Strict parser rejects duplicate members | Parser differential in other languages’ clients — must reuse test vectors |
| T | Clock rollback | Highest observed time, trusted server time, signed `iat` floor, monotonic in-session check | Reinstall of OS + wipe of secure store; offline machine with no server contact |
| T | Grant rollback to an older version | `license_version` monotonic in `GrantStore` | Wipe of secure store resets local state |
| T | Audit log modification | Hash chain; DB role without UPDATE/DELETE; external log sink | Insider with DBA rights deleting tail (detect via sink comparison) |
| **R**epudiation | Operator denies issuing codes | Immutable order records; audit chain with actor, before/after | — |
| **I**nformation disclosure | Code enumeration via distinct errors | Identical public error for unknown/used/expired/wrong-product | Timing side channels (measure in L8) |
| I | Plaintext codes in logs | Only HMAC hash stored; audit refuses secret-like fields; codes shown once | Codes in customer email (delivery channel) |
| I | Privacy over-collection | Allowlisted device signals, salted hashes only, no MAC/paths/location | Fingerprint linkability within one product salt |
| **D**enial of service | Brute-force or flood activation | Rate limits per IP, code hash, installation, fingerprint; WAF; request size limits | Shared enterprise NAT false positives (adaptive limits backlog) |
| D | Licensing outage disables customers | Offline validation; client never calls the service per feature | First activation and renewal unavailable during outage |
| D | Key Vault unavailable | Transaction rolls back; retry with same idempotency key | Activation unavailable |
| **E**levation of privilege | UI-only feature gating bypass | Entitlements enforced in services, workers, server API, extension host | Patched client binaries (accepted for offline software) |
| E | IDOR on renewal (`license_id` path) | Presented grant must be signed and match path, installation, and fingerprint | — |
| E | Operator issues unapproved bulk codes | Dual approval above threshold; separation of duties | Collusion of two approvers |
| E | Malicious extension | Publisher signature + per-file SHA-256 + ZIP traversal/duplicate checks + permissions | Compromised publisher key until revoked |

## Accepted limitations (disclosed)

- An offline installation cannot be revoked until it next contacts the service.
- A determined user can patch client binaries; licensing deters casual misuse
  and makes commercial violations evident, it is not DRM.
- Customer data is never held hostage: read, copy, and open-format export are
  always allowed.

## Abuse cases covered by tests

See [security-test-plan.md](security-test-plan.md) for the mapping from each
threat to automated tests and their current status.
