# Current state

Assessed 2026-11-18 on branch `architecture/hyperoffice-foundation`.

## Starting point

The repository was not under version control. It contained an empty scaffold
created earlier: zero-byte root files (README, LICENSE, workflows, etc.) and
empty folders under `apps/hyperdoc/src/*` and `apps/hypersheet/src/*`. No code,
dependencies, or tests existed. The zero-byte files were replaced with real
content; the empty `apps/` folders were kept (they contain nothing to migrate).

## Environment

| Tool | Status |
| --- | --- |
| Node.js | 26.13.0 (native TypeScript type stripping) |
| npm | 11.20.0 |
| pnpm | 12.21.0 via `npx` (not globally installed) |
| Git | 2.47.0 |
| Rust (`cargo`, `rustc`) | **Not installed** — see ADR-0003 |
| Python | Not installed (Store alias only) |
| Network | npm registry and GitHub reachable |

The workspace lives inside a OneDrive-synchronised folder. `node_modules` and
`.turbo` are large and churn frequently; moving the clone outside OneDrive is
recommended.

## Implemented now

| Module | Status |
| --- | --- |
| Monorepo configuration, CI, governance files | Done |
| `tools/format-detector` (L0 detection + bounded ZIP reader) | Experimental, tested |
| Capability manifest schema + 5 manifests (all L0) | Done, schema-validated |
| Minimal fixtures (DOCX, XLSX, PPTX, DOCM, MSPDI) | Detection fixtures only |
| Licensing packages and service use cases | Experimental, tested (development keys) |

## Not present

Applications (web, desktop, product editors), Rust crates, document models,
rendering, conversion, collaboration, extensions, AI, REA investigations, e2e tests.
