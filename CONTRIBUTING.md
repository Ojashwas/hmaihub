# Contributing to HyperOffice

## Workflow

- Trunk-based development with short-lived branches:
  `feature/<area>-<description>`, `fix/<area>-<description>`,
  `research/rea-<feature-id>`, `architecture/<description>`, `security/<description>`.
- Conventional Commits, for example `feat(hypersheet): add formula tokenizer`.
- Run `pnpm check` before opening a pull request.

## Pull requests

Fill in every section of [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
CODEOWNERS approval is required for parsers, cryptography, licensing,
authentication, the extension sandbox, conversion workers, and compatibility claims.

## Compatibility claims

No format or feature may be marked compatible (level L5 or L6) without:

1. an REA investigation record under `research/rea/investigations/`;
2. automated round-trip evidence;
3. a reviewed compatibility report.

See [research/rea/README.md](research/rea/README.md).

## Module requirements

Every module must contain a `README.md`, a manifest, a public API entry
point, at least one test, ownership information, and a status
(`experimental`, `preview`, `stable`, or `deprecated`).
