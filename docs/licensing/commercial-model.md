# Commercial model

Status: draft policy for legal, tax, privacy, and refund review.

## Products and editions

Products: HyperOffice Suite (`hyperoffice-suite`), HyperDoc, HyperSheet,
HyperDeck, HyperPlan, HyperAI, HyperOffice Extension SDK, and feature packs.

Editions: Trial, Individual, Professional, Business, Enterprise, Education,
Developer, Internal Testing.

Modes: subscription, fixed-term, perpetual with maintenance expiry, enterprise
offline, floating seat (later), development/test.

## Default policy (server-configurable, never compiled into clients)

| Setting | Default | Location |
| --- | --- | --- |
| Term | 6 calendar months (UTC, month-end clamping) | `DEFAULT_POLICY.defaultTerm` / template `term` |
| Term start | Successful activation, unless the template has a contractual start | template `contractStart` |
| Grace period | 14 days | `DEFAULT_POLICY.graceDays` |
| Renewal start | `max(current expiry, server time)` | `DEFAULT_POLICY.renewalPolicy` |
| Installations | Template `limits.installations` and code `maxInstallations` | template / code |
| Bulk approval threshold | 50 codes | `DEFAULT_POLICY.bulkApprovalThreshold` |

## After expiry

| Capability | During term | Grace period | After grace |
| --- | --- | --- | --- |
| Open, read, copy own files | Yes | Yes | **Yes** |
| Export to an open format | Yes | Yes | **Yes** |
| Editing and premium features | Yes | Yes (with notice) | No |

HyperOffice never deletes, encrypts, corrupts, watermarks, or withholds customer
files because a licence expired. This is enforced in
[entitlement-sdk](../../packages/entitlement-sdk/src/capability-map.ts) by the
`data-access` capability class, which is always allowed.

## Code types (distinct names in code and UI)

- **Activation Code**: first activation.
- **Renewal Code**: extends the commercial term.
- **Feature Code**: adds features, seats, installations, or maintenance.
- **Extension Package**: installable executable extension; unrelated to codes.

## Not in scope until separately approved

Automatic recurring payment. It requires a billing contract, explicit consent,
payment-provider approval, notices, a cancellation workflow, and a refund policy.

## Disclosures before activation (EN/AR required for UAE)

Device information collected and why, retention, sharing, support process,
installation limit, term, exact expiry behaviour, grace period, renewal
requirement, refund policy. Arabic text must be produced and reviewed by a
qualified translator and legal reviewer; it is not yet written.
