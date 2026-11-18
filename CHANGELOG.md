# Changelog

All notable changes are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Monorepo foundation (pnpm workspaces, Turborepo, strict TypeScript, ESLint, Prettier).
- Architecture current-state, target-state, gap analysis, ADR index, and backlog.
- Pinned REA (`rea-agents@6.9.0`) as an external research tool.
- File-format capability manifest schema and L0 manifests for DOCX, XLSX, PPTX, and MSPDI.
- `@hyperoffice/format-detector` with bounded ZIP central-directory inspection.
- Licensing L0 documents (threat model, ADRs, schemas, OpenAPI contract, database model).
- Licensing L1 packages: `licensing-core`, `licensing-client`, `entitlement-sdk`,
  `services/licensing` use cases, and a development-only licence issuer.
