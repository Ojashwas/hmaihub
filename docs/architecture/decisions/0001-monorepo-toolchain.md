# ADR-0001: pnpm workspaces, Turborepo, strict TypeScript

Status: Accepted

## Context

HyperOffice combines TypeScript applications, services, SDKs, and (later) Rust
engines compiled to WebAssembly. A single repository with explicit package
boundaries is required.

## Decision

- pnpm workspaces (`packages/*`, `services/*`, `tools/*`), pinned with
  `packageManager: pnpm@12.21.0`.
- Turborepo for task orchestration.
- TypeScript 5.9 in strict mode with `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`.
- ESLint (typescript-eslint strict) and Prettier.
- Rust workspace (`Cargo.toml`) added when the first crate lands (ADR-0003).

TypeScript 7 was available but not selected because typescript-eslint
8.73 supports `typescript <6.1`.

## Consequences

- `apps/*` is not yet a workspace glob; existing `apps/hyperdoc` and
  `apps/hypersheet` folders are empty scaffolds and will be added when they
  contain packages.
- Workspace packages export TypeScript sources directly (`exports` → `src/index.ts`);
  a build step is introduced when a package is published or bundled.
