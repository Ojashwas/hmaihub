# Glossary

| Term | Meaning |
| --- | --- |
| Activation Code | Single- or multi-installation commercial code (`HO1-…`) redeemed once per installation to obtain a licence grant |
| ADR | Architecture Decision Record |
| Capability | Stable identifier of a gated function, e.g. `documents.edit` |
| Capability manifest | JSON file declaring what HyperOffice supports for one file format |
| Code hash | `HMAC-SHA-256(pepper, normalised code)`; the only stored form of a code |
| Compatibility level | L0 detect · L1 inspect · L2 read model · L3 edit subset · L4 save/reopen · L5 round-trip with Microsoft Office · L6 high fidelity |
| Data-access capability | Open, copy, export-to-open-format; always allowed |
| Device fingerprint | Salted SHA-256 of allowlisted stable device signals |
| Extension Package | Signed ZIP that installs executable add-on functionality; not a licence code |
| Feature Code | Single-use code adding features, seats, or installations |
| Grace period | Time after `exp` (default 14 days) during which licensed features still work |
| Grant / licence grant | Signed JWS authorising an installation; verified offline |
| HSM | Hardware Security Module (Azure Managed HSM) |
| Idempotency key | Client-chosen key that makes retries return the same result |
| Installation ID | Random opaque identifier (`ins_…`) of one installation |
| JWS / JWK | JSON Web Signature / JSON Web Key (RFC 7515 / 7517) |
| kid | Key identifier in the JWS header |
| MSPDI | Microsoft Project XML interchange format |
| Nonce | ≥128-bit random value preventing request replay |
| OOXML / OPC | Office Open XML / Open Packaging Conventions (ECMA-376) |
| OLE / CFB | Compound File Binary container used by legacy Office files and encrypted OOXML |
| Pepper | Server-side secret (Key Vault) used in the code hash |
| REA | "Reverse Engineer Anything" research tool (`rea-agents`) |
| Renewal Code | Single-use code extending the licence term |
| SAD / TDD | System Architecture Design / Technical Design Document |
| Support reference | `HSR-…` identifier shown with errors and linked to the audit chain |
| Trust store | Set of public keys a build accepts, filtered by environment |
