# Licensing privacy data map

| Data | Where | Purpose | Form | Retention (proposed, needs legal review) |
| --- | --- | --- | --- | --- |
| Activation code | Client input, transit | Redeem | Plaintext in TLS only; stored as HMAC hash | Hash: life of licence + 7 years |
| Installation ID | Client, server | Bind grant | Random opaque ID | Life of licence + 2 years |
| Device fingerprint | Client, server | Installation binding | Salted SHA-256 of allowlisted signals | Life of installation + 1 year |
| Per-signal hashes | Client secure store only | Tolerate hardware changes | Salted SHA-256 | Until deactivation |
| App version, platform | Server | Support, compatibility | Plain | Life of licence |
| Source IP | Rate limiter, audit (where legally permitted) | Abuse prevention | Plain / truncated | Rate limiter: window only; audit: 90 days |
| Customer ID | Server, grant | Ownership | Opaque | Contractual |
| Name, email, billing address | Billing provider / CRM | Invoicing | Not in licensing grants | Per billing contract |

**Never collected:** document content or names, file paths, browsing history,
contacts, Wi-Fi scans, precise location, MAC addresses, unrelated hardware inventory.

Diagnostics exported by the client (`buildDiagnostics`) contain status, reason,
key ID, licence ID/version, edition, products, feature count, expiry, and grant
hash — no customer ID, installation ID, fingerprint, or token.

English and Arabic disclosure texts are pending (see commercial model).
