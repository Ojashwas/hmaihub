# Licensing security test plan

Status of each required test as of this iteration. "Automated" means it exists
and passed in the recorded run; nothing else is claimed.

## Unit tests (required list)

| Test | Status | Location |
| --- | --- | --- |
| Valid activation | Automated | services/licensing/tests/unit/activation.test.ts |
| Invalid / expired / already-redeemed code | Automated (identical public error) | activation.test.ts |
| Maximum installations reached | Automated | activation.test.ts |
| Wrong product | Automated | activation.test.ts |
| Wrong customer binding | Automated | renewal.test.ts |
| Valid signature; modified payload / header / signature | Automated | packages/licensing-core/tests/jws.test.ts |
| `alg=none`; algorithm substitution; unknown kid | Automated | jws.test.ts |
| Wrong issuer / audience | Automated | jws.test.ts |
| Expired / not-yet-valid / grace valid / grace expired | Automated (exact boundaries) | jws.test.ts |
| Wrong installation | Automated | jws.test.ts, licensing-client tests |
| Malformed JSON, duplicate fields, invalid base64url | Automated | jws.test.ts, strict-json.test.ts |
| Clock rollback | Automated | packages/licensing-client/tests |
| Early / late / month-end / leap-year renewal | Automated | policies.test.ts, renewal.test.ts |
| Simultaneous redemption (activation and renewal) | Automated | activation.test.ts, renewal.test.ts |
| Retry after timeout (idempotency) | Automated | activation.test.ts, renewal.test.ts |
| Duplicate webhook | **Not started** (no billing adapter) | — |
| Secure-store failure; atomic update failure | Automated (in-memory store) | licensing-client tests |
| Signing-key rotation; retired key; compromised-key simulation | Automated | activation.test.ts, jws.test.ts |

## Security tests

| Test | Status |
| --- | --- |
| Activation-code enumeration (uniform errors) | Automated |
| Brute-force rate limiting (IP, code hash, window reset) | Automated (in-memory limiter) |
| Replay (nonce) | Automated |
| IDOR on renewal path | Automated |
| Privilege escalation, CSRF, admin MFA | Not started (no admin API) |
| SQL injection | Not started (no SQL adapter); parameterised queries mandated |
| JSON parser ambiguity | Automated (duplicate members, escapes, depth, `__proto__`) |
| Request smuggling at gateway | Not started (infrastructure) |
| Log injection | Implemented (control-character stripping); test pending |
| Audit tampering | Automated (hash chain) |
| Key Vault access failure | Automated (rollback with failing signer) |
| Database rollback | Automated (in-memory serializable transaction) |
| Package tampering / ZIP traversal / duplicates / bombs | Automated for format detection; extension packages not started |
| Extension signature bypass, untrusted publisher, revoked extension | Not started (Phase L6) |
| Offline licence rollback (version) | Automated |
| Timing side channels on activation | Not started (L8) |
| Penetration test | Not started (required before commercial release) |

## Property-based tests

Code normalisation, check-symbol error detection, date arithmetic, renewal
monotonicity, strict-JSON equivalence with `JSON.parse`, entitlement data-access
invariant, format-detector robustness to random and mutated input.
