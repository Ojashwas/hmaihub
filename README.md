# HyperOffice

A cross-platform productivity suite: HyperDoc (documents), HyperSheet
(spreadsheets), HyperDeck (presentations), HyperPlan (project scheduling),
HyperAI, and the HyperWorkspace shell.

## Project status

**Phase 0 (foundation), pre-alpha.** No editor application exists yet. Do not
use HyperOffice for real documents.

| Area | State |
| --- | --- |
| Monorepo, CI, ADRs, governance | In place |
| Format detection (L0) | Implemented in `tools/format-detector` |
| Document engines (Rust) | Not started; Rust toolchain not provisioned ([ADR-0003](docs/architecture/decisions/0003-rust-engines-deferred.md)) |
| Applications | Not started |
| Licensing | L0 design + L1 implementation with development keys only |

## Supported formats

Machine-readable claims live in [compatibility/manifests/](compatibility/manifests/).

| Format | Level | Meaning |
| --- | --- | --- |
| DOCX, DOCM | L0 | Detect only |
| XLSX | L0 | Detect only |
| PPTX | L0 | Detect only |
| Microsoft Project XML (MSPDI) | L0 | Detect only |

Levels: L0 detect · L1 inspect · L2 read model · L3 edit subset · L4 save/reopen ·
L5 round-trip tested with Microsoft Office · L6 high-fidelity. No format is above L0.

## Architecture

Full documentation index (installation, user guides, architecture, technical
design, functional specification, licensing): [docs/README.md](docs/README.md).

See [docs/architecture/target-state.md](docs/architecture/target-state.md),
[current-state.md](docs/architecture/current-state.md),
[gap-analysis.md](docs/architecture/gap-analysis.md), and the
[ADR index](docs/architecture/decisions/README.md).

## Prerequisites

- Node.js ≥ 26.12.1
- pnpm 12.21.0 (`npm i -g pnpm@12.21.0` or `npx pnpm@12.21.0 ...`)
- Rust stable (required from Phase 1; not yet used)

## Setup, build, test

```powershell
pnpm install
pnpm build          # no package needs a build step yet
pnpm test           # all workspace test suites via Turborepo
pnpm lint
pnpm typecheck
pnpm format:check
pnpm check          # all of the above
```

`pnpm test:e2e` intentionally fails until a UI vertical slice exists.

## Run

```powershell
node tools/format-detector/src/cli.ts compatibility/fixtures/word/minimal.docx
node tools/development-license-issuer/src/cli.ts --installation ins_DEVMACHINE0001 --device sha256:<43 base64url chars>
```

## Security

- Treat every Office file as hostile; limits are in [docs/security/file-processing.md](docs/security/file-processing.md).
- Licensing uses asymmetric signatures; production keys live only in Azure Key Vault / Managed HSM.
  This repository contains **no production key**. `.dev-keys/` is git-ignored.
- Report vulnerabilities per [SECURITY.md](SECURITY.md).

## REA requirement

Compatibility work uses REA (`rea-agents@6.9.0`, MIT) as a pinned external tool.
See [research/rea/README.md](research/rea/README.md) and
[docs/research/rea-version.md](docs/research/rea-version.md). No investigation
has been performed yet.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Licence

Proprietary; outbound licence not yet chosen ([LICENSE](LICENSE)).
Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Known limitations

- No Rust crates, document models, renderers, editors, or conversion.
- PPTX fixture is incomplete for PowerPoint (detection only).
- Licensing service has no HTTP adapter, database adapter, or Key Vault signer.
- Platform secure storage for licences is not implemented.
- CI workflows have not yet been executed on GitHub.
