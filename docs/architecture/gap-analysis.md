# Gap analysis against the first-milestone acceptance criteria

| # | Criterion | Status | Gap / next action |
| --- | --- | --- | --- |
| 1 | `pnpm install` | Met | — |
| 2 | `cargo build --workspace` | **Not met** | Install Rust toolchain; create `crates/office-package` (ADR-0003) |
| 3 | `pnpm build` | Met (no package needs a build step yet) | Add builds when bundling apps |
| 4 | `cargo test --workspace` | **Not met** | As #2 |
| 5 | `pnpm test` | Met | — |
| 6 | `pnpm test:e2e` | **Not met** (script fails deliberately) | Needs a UI vertical slice + Playwright |
| 7 | `pnpm lint` | Met | — |
| 8 | `pnpm typecheck` | Met | — |
| CLI | Detect DOCX/XLSX/PPTX/Project XML | Met (L0) | — |
| CLI | List package parts | Partial (`parts` in detection JSON) | `hyperoffice inspect` command |
| CLI | Validate content types and relationships | Not met | Phase 1 |
| CLI | Normalize XML, compare packages | Not met | Phase 1 (`xml-normalizer`, `package-diff`) |
| CLI | JSON compatibility report | Partial (manifests) | Report generator |
| Apps | Open/edit/save/reopen minimal files | Not met | Phase 2–3 |
| REA | Pinned + installation docs | Met | — |
| REA | One approved sample investigation per product | **Not met** | Requires an authorised reference environment (licensed Microsoft Office) and a human approver; cannot be fabricated |
| Claims | No placeholder "fully supported" claims | Met | All manifests are L0 |

## Highest-priority gaps

1. Rust toolchain and the `office-package` crate (port detector tests).
2. Package inspection CLI (`inspect`, `validate`, `normalize`, `diff`).
3. Authorised REA reference environment and the first four investigations.
4. Licensing HTTP adapter and PostgreSQL repository (Phase L2 completion).
