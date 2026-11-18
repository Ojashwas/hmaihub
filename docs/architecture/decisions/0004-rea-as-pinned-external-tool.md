# ADR-0004: REA as a pinned external npm tool

Status: Accepted

## Context

REA (morluto/rea, MIT) is mandatory for behavioural investigations. It must not
be copied into production packages and CI must not run unreviewed upstream code.

## Decision

- Option A: run the published `rea-agents` npm package at an exact version,
  `6.9.0`, through `pnpm rea` (`npx --yes rea-agents@6.9.0`).
- Record the version, tarball integrity (`sha512-KqDn1UR5…`), and licence in
  `third_party/rea.version`, `docs/research/rea-version.md`, and `THIRD_PARTY_NOTICES.md`.
- REA is **not** a `devDependency`: it is large, has optional native providers,
  and must not be pulled into every `pnpm install` or CI job.
- No Git submodule.

## Consequences

- Upgrades are explicit pull requests with a recorded reviewer.
- CI jobs that run REA must pin `rea-agents@<version>` and verify integrity.
- REA's own setup command (`rea-agents setup`) modifies agent configuration and
  is run only by a researcher on a workstation, never in CI.
