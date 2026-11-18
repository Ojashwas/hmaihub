# Architecture Decision Records

Format: context, decision, consequences, status. Statuses: Proposed, Accepted,
Superseded, Rejected. "Accepted" here means accepted for the current iteration
and still subject to the security review gates in [ROADMAP.md](../../../ROADMAP.md).

## Foundation

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-monorepo-toolchain.md) | pnpm workspaces + Turborepo + strict TypeScript | Accepted |
| [0002](0002-zero-dependency-bootstrap.md) | Node.js native TypeScript execution and `node:test` for the bootstrap | Accepted (temporary deviation) |
| [0003](0003-rust-engines-deferred.md) | Rust core engines deferred until the toolchain is provisioned | Accepted |
| [0004](0004-rea-as-pinned-external-tool.md) | REA as a pinned external npm tool | Accepted |
| [0005](0005-backend-framework.md) | Backend framework default | Proposed |

## Licensing

| ADR | Title | Status |
| --- | --- | --- |
| [0101](0101-one-time-online-activation.md) | One-time online activation with offline-verifiable grants | Accepted |
| [0102](0102-asymmetric-signing.md) | Asymmetric JWS signing (EdDSA preferred, ES256 fallback) | Accepted |
| [0103](0103-key-vault-managed-hsm-signing.md) | Azure Key Vault / Managed HSM for production signing | Accepted, not implemented |
| [0104](0104-six-calendar-month-expiry.md) | Six-calendar-month term with UTC month-end clamping | Accepted |

## Required but not yet written

- Collaboration model per product (CRDT / OT / hybrid).
- Desktop shell (Tauri 2 vs Electron).
- MPP adapter isolation and licensing (MPXJ licence review).
- Extension sandbox technology.
