# Licensing implementation backlog

Status key: Done (implemented and tested in this repository), Partial, Not started.

| ID | Phase | Item | Status | Dependency | Acceptance |
| --- | --- | --- | --- | --- | --- |
| LIC-001 | L0 | Threat model | Done (draft) | — | Security review sign-off |
| LIC-002 | L0 | Commercial policy | Done (draft) | — | Legal, tax, refund review |
| LIC-003 | L0 | Grant + entitlement schemas | Done | — | Contract tests pass |
| LIC-004 | L0 | ADRs 0101–0104 | Done | — | Review |
| LIC-005 | L0 | Privacy data map | Done (draft) | — | Privacy review |
| LIC-010 | L1 | Development signing key + local issuer | Done | — | Dev grant verifies; refused in prod |
| LIC-011 | L1 | JWS grant + strict verifier | Done | — | Rejection matrix tests |
| LIC-012 | L1 | Feature-gate API | Done | — | Data-access invariant property test |
| LIC-013 | L1 | Deterministic test vectors (EdDSA, ES256) | Done | — | Reproducible vector test |
| LIC-020 | L2 | PostgreSQL model | Partial (SQL drafted, not executed) | Postgres in CI | Migration applies; repository tests run against Postgres |
| LIC-021 | L2 | Code generator | Done | — | Rejection sampling + uniformity tests |
| LIC-022 | L2 | Activation use case | Done | — | Unit + concurrency tests |
| LIC-023 | L2 | HTTP adapter + request-size limits + OpenAPI conformance | Not started | ADR-0005 | Contract tests over HTTP |
| LIC-024 | L2 | Shared rate-limit store / gateway limits; adaptive NAT handling | Not started | Infra | Load test |
| LIC-025 | L2 | Audit sink outside the database | Not started | Azure Monitor | Chain comparison job |
| LIC-030 | L3 | SecureStore: DPAPI, Keychain, Secret Service | Not started | Native bindings / Tauri | Platform tests |
| LIC-031 | L3 | Installation binding with weighted matching | Partial (library done) | LIC-030 | Signal collectors per OS |
| LIC-032 | L3 | Grace period + read/export expiry mode in UI | Partial (gates done) | Apps | E2E test |
| LIC-033 | L3 | Clock rollback defence | Partial (library done) | LIC-030 | Persisted state tests |
| LIC-040 | L4 | Renewal + feature codes | Done (use case) | — | Unit tests |
| LIC-041 | L4 | Deactivation, support reset, waiting period | Not started | LIC-023 | — |
| LIC-042 | L4 | Offline licence request/signer/installer tools | Not started | LIC-023 | — |
| LIC-050 | L5 | Key Vault / Managed HSM signer, pepper via managed identity | Not started | Azure subscription | Signing integration test |
| LIC-051 | L5 | Key rotation workflow + client key-set release process | Partial (verifier supports statuses) | LIC-050 | Rotation rehearsal |
| LIC-052 | L5 | Disaster recovery (PITR, multi-region) | Not started | Infra | Restore drill |
| LIC-060 | L6 | Extension package signing and verification | Not started | Publisher PKI | Tamper tests |
| LIC-070 | L7 | Admin portal (Entra ID, roles, separation of duties) | Not started | LIC-023 | — |
| LIC-071 | L7 | Billing adapters + webhook verification | Not started (blocked by L0–L6 review) | — | Duplicate/refund/chargeback tests |
| LIC-072 | L7 | English and Arabic commercial screens and disclosures | Not started | Translator + legal | Review sign-off |
| LIC-080 | L8 | External penetration test, DR and key-compromise exercises | Not started | All above | No open critical/high findings |

Production codes and real billing remain blocked until L0–L6 pass security review.
