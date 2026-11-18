# Functional Specification

| Item | Value |
| --- | --- |
| Version | 0.1 |
| Date | 2026-11-18 |
| Status legend | **Implemented** (code + passing tests) · **Library** (logic implemented, no UI/endpoint) · **Designed** (documented only) · **Planned** (not designed in detail) |

## 1. Actors

| Actor | Description |
| --- | --- |
| End user | Uses HyperOffice applications |
| Customer administrator | Manages an organisation's licences and installations |
| Licensing Viewer / Support / Operator / Manager | HyperOffice staff roles with increasing rights |
| Security Administrator, Key Custodian, Auditor | Security and oversight roles |
| Billing provider / reseller | Sends verified purchase events |
| Researcher | Runs authorised REA investigations |
| Developer | Builds and tests HyperOffice |

## 2. Product functions

| ID | Function | Status |
| --- | --- | --- |
| FR-DOC-001 | Detect DOCX/DOCM/DOTX/DOTM by content | Implemented (L0) |
| FR-SHT-001 | Detect XLSX/XLSM/XLTX/XLTM by content | Implemented (L0) |
| FR-DCK-001 | Detect PPTX/PPTM/POTX/POTM/PPSX/PPSM by content | Implemented (L0) |
| FR-PLN-001 | Detect Microsoft Project XML (MSPDI) | Implemented (L0) |
| FR-PKG-001 | Reject unsafe packages (traversal, duplicates, bombs, DTDs, oversize) | Implemented |
| FR-PKG-002 | Report macros, encryption, extension spoofing | Implemented |
| FR-CMP-001 | Machine-readable capability manifests; reject unsupported L5/L6 claims | Implemented |
| FR-DOC-010… | Open, edit, save documents, spreadsheets, presentations, projects | Planned (Phases 2–3) |
| FR-CNV-001 | Conversion graph with loss reports | Planned (Phase 4) |
| FR-COL-001 | Real-time collaboration | Planned (Phase 5) |
| FR-EXT-001 | Extension SDK and Office Add-in subset | Planned (Phase 6) |
| FR-AI-001 | Opt-in AI assistance with preview/accept/reject/undo | Planned |

## 3. Licensing functions

| ID | Function | Status |
| --- | --- | --- |
| FR-LIC-001 | Generate activation, renewal, and feature codes from an approved order (CSPRNG, HMAC lookup hash, plaintext shown once) | Library |
| FR-LIC-002 | Dual approval for bulk generation above threshold | Library |
| FR-LIC-003 | Validate code format and check symbol on the client before sending | Library |
| FR-LIC-004 | One-time online activation returning a signed grant | Library |
| FR-LIC-005 | Idempotent activation; retries never consume extra activations | Library |
| FR-LIC-006 | Uniform public error for unknown/used/expired/wrong-product codes, with support reference | Library |
| FR-LIC-007 | Rate limiting by IP, code, installation, fingerprint with retry-after | Library |
| FR-LIC-008 | Offline grant validation at launch and before licensed features | Library |
| FR-LIC-009 | 14-day grace period after expiry | Library |
| FR-LIC-010 | After expiry: read, copy, export to open format always allowed; editing paused | Library |
| FR-LIC-011 | Clock-rollback detection and online time verification recovery | Library (online verification Planned) |
| FR-LIC-012 | Device binding tolerant of hardware changes | Library (signal collectors Planned) |
| FR-LIC-013 | Renewal preserving remaining time | Library |
| FR-LIC-014 | Feature codes adding features, seats, installations | Library |
| FR-LIC-015 | Replacement grant installed atomically; no version rollback | Library |
| FR-LIC-016 | Tamper-evident audit of all licensing actions | Library |
| FR-LIC-017 | Signing-key rotation with overlap; compromised-key rejection | Library (Key Vault Planned) |
| FR-LIC-018 | Development licence issuer, disabled in production | Implemented |
| FR-LIC-019 | Self-service and administrator deactivation; support reset | Designed |
| FR-LIC-020 | Enterprise offline licence request/response | Designed |
| FR-LIC-021 | Admin portal with Entra ID roles and separation of duties | Designed |
| FR-LIC-022 | Billing webhook processing (refunds, chargebacks) | Designed |
| FR-LIC-023 | English and Arabic commercial disclosures | Planned |
| FR-LIC-024 | Signed extension packages | Designed |

## 4. Business rules

| ID | Rule |
| --- | --- |
| BR-01 | Default term: 6 calendar months in UTC from activation; day clamps to month end. |
| BR-02 | Term starts at activation unless the template has a contractual start date. |
| BR-03 | Grace period: 14 days after expiry (configurable server-side). |
| BR-04 | Renewal start = later of current expiry and renewal time (default policy). |
| BR-05 | Renewal and feature codes are single-use; activation codes allow `max_installations` installations. |
| BR-06 | Re-activation of the same installation with the same fingerprint does not consume a slot. |
| BR-07 | Same installation ID with a different fingerprint requires a support reset. |
| BR-08 | Data-access capabilities are never denied. |
| BR-09 | Licensed capabilities fail closed on any invalid state. |
| BR-10 | Product `hyperoffice-suite` covers every product. |
| BR-11 | Plaintext codes, tokens, keys, and fingerprints never appear in audit events or logs. |
| BR-12 | Bulk generation above 50 codes needs an approver different from the requester. |
| BR-13 | No automatic recurring payment without separate approval and consent. |
| BR-14 | No compatibility claim above L4 without REA evidence and a reviewed report. |

## 5. Key use cases

### UC-01 Activate

**Precondition:** valid unredeemed activation code, network available.
**Main flow:** user enters code → client validates format → client sends
request with installation ID, fingerprint, nonce, idempotency key → service
validates and signs → client validates grant, stores it, records server time.
**Alternatives:** timeout → client resends the same request → same result;
invalid code → generic error with support reference; too many attempts → retry later.
**Postcondition:** licence works offline until `grace_until`.

### UC-02 Use a licensed feature offline

Client checks clock → validates grant → entitlement gate decides → feature runs
or a status message is shown. Opening/exporting files is never blocked.

### UC-03 Renew

User enters Renewal Code → client sends current grant + code → service verifies
and issues replacement → client installs atomically, refusing older versions.

### UC-04 Clock rolled back

Client detects rollback → editing paused, files accessible → user corrects
clock or verifies time online → normal operation.

### UC-05 Issue codes for an order

Operator submits approved order → service generates codes, stores hashes →
plaintext returned once → audit event records code IDs only.

### UC-06 Detect a file

Developer/service passes bytes → detector returns format, evidence, warnings
or rejects the file with a security code.

## 6. Acceptance criteria (current scope)

All licensing and detection functions marked Implemented or Library have
automated tests that pass ([Test Report](test-report.md)). Commercial readiness
requires the 25 criteria in the licensing brief; see
[licensing/implementation-backlog.md](licensing/implementation-backlog.md).
