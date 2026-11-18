# third_party

External tools and vendored material. Nothing in this directory is linked into
HyperOffice production packages.

| Item | Mode | Pin |
| --- | --- | --- |
| REA (`rea-agents`) | Pinned external npm tool, executed with `pnpm rea` | [rea.version](rea.version) |

REA is not vendored as a Git submodule. The pinned npm package was chosen
(option A) because it keeps REA out of the build graph. See
[ADR-0004](../docs/architecture/decisions/0004-rea-as-pinned-external-tool.md).

Upgrading REA requires a pull request that updates `rea.version`,
`docs/research/rea-version.md`, and `THIRD_PARTY_NOTICES.md`, and records the
reviewer.
