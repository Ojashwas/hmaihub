# Implementation backlog (product foundation)

Licensing items are tracked separately in [docs/licensing/implementation-backlog.md](../licensing/implementation-backlog.md).

| ID | Epic | Capability | User story | Technical task | Dependency | Owner | Risk | Acceptance criteria | Test requirement | REA evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-001 | Foundation | Monorepo | As a developer I can build and test from a clean clone | pnpm, Turborepo, TS strict, ESLint, Prettier | — | TBD | Low | `pnpm install && pnpm check` passes | CI | No | Done |
| F-002 | Foundation | CI | As a maintainer every PR is checked | ci/test/security workflows | F-001 | TBD | Low | Workflows green on GitHub | CI run | No | Done (not yet run on GitHub) |
| F-003 | Foundation | Rust toolchain | As an engine developer I can build crates | rustup stable, nextest, deny, audit; Cargo workspace | — | TBD | Medium | `cargo test --workspace` passes | CI | No | Not started |
| F-004 | Foundation | Dev container | As a contributor I get a reproducible environment | `.devcontainer` with Node 26 + Rust | F-003 | TBD | Low | Container builds | CI | No | Not started |
| F-005 | Foundation | REA | As a researcher I run pinned REA | Pin, docs, investigation template | — | TBD | Low | `pnpm rea --version` reports 6.9.0 | Manual | — | Done (pin); first run not executed |
| P1-001 | Package inspection | Format detection | Detect formats by content | `format-detector` L0 | F-001 | TBD | Medium | Fixtures detected; hostile inputs rejected | Unit, property | No (L0) | Done |
| P1-002 | Package inspection | ZIP/OLE abstraction | Read packages safely | Rust `office-package` with limits | F-003 | TBD | High | Ports all detector tests | Unit, fuzz | No | Not started |
| P1-003 | Package inspection | Content types & relationships | Validate package structure | Parser + validator | P1-002 | TBD | High | Rejects malformed rels | Unit, fuzz | No | Not started |
| P1-004 | Package inspection | XML normalizer & package diff | Compare two packages | Canonicaliser + diff | P1-003 | TBD | Medium | Stable diff output | Golden | No | Not started |
| P1-005 | Package inspection | CLI | `hyperoffice inspect/validate/diff/normalize` | CLI wrapper | P1-004 | TBD | Low | Commands documented | Integration | No | Not started |
| P2-001 | HyperDoc | Read minimal DOCX | Open and display paragraphs | Word model + renderer | P1-003 | TBD | High | Minimal + RTL fixture renders | Round-trip, golden | HDOC-PARA-001 | Not started |
| P2-002 | HyperSheet | Read minimal XLSX | Display cells and cached values | Sheet model | P1-003 | TBD | High | Minimal fixture renders | Round-trip | HSHEET-CELL-001 | Not started |
| P2-003 | HyperDeck | Read minimal PPTX | Display slides | Deck model; complete fixture with master/layout/theme | P1-003 | TBD | High | Fixture opens in PowerPoint and HyperDeck | Round-trip | HDECK-SLIDE-001 | Not started |
| P2-004 | HyperPlan | Import MSPDI | Display tasks and dependencies | Project model | P1-001 | TBD | High | Minimal schedule renders | Unit | HPLAN-TASK-001 | Not started |
| L-001 | Licensing | See licensing backlog | — | — | — | Security | — | — | — | — | Partial |
