# ADR-0002: Native TypeScript execution and node:test for the bootstrap

Status: Accepted (temporary deviation from the Vitest baseline)

## Context

The master prompt names Vitest for unit tests. The development machine has
Node.js 26.13, which executes erasable TypeScript directly (type stripping) and
ships `node:test`. Keeping the security-critical licensing packages free of
runtime dependencies reduces supply-chain exposure.

## Decision

- Packages are written in erasable TypeScript (no enums, namespaces, or parameter
  properties; enforced by `erasableSyntaxOnly` and an ESLint rule).
- Tests use `node:test` + `node:assert/strict`, run with `node --test`.
- Property-based tests use `fast-check` (dev dependency).
- JSON Schema contract tests use `ajv` (dev dependency).
- Type checking is a separate `tsc --noEmit` step, because Node does not type-check.

## Consequences

- No transpile step for tests; failures point at source lines.
- Vitest is adopted when browser/UI packages arrive (React components need jsdom
  or browser mode). Both runners can coexist per package.
- Runtime packages depend only on `node:crypto`, `node:zlib`, and workspace packages.
- Node.js >= 26.12.1 is required (also REA's minimum on the 26.x line).
