# Third-Party Notices

## Research tools (not distributed in HyperOffice products)

### REA — Reverse Engineer Anything

- Upstream: https://github.com/morluto/rea
- Package: `rea-agents`
- Pinned version: 6.9.0 (see [third_party/rea.version](third_party/rea.version))
- Licence: MIT (REA-authored code). Third-party material bundled by REA retains its own licences.
- Usage: external, separately executed research tool. No REA source is copied into HyperOffice packages.

## Development dependencies

Development dependencies are declared in `package.json` and resolved through
`pnpm-lock.yaml`. A generated licence inventory (CycloneDX SBOM) is planned in
the `sbom` workflow and is not yet produced.

## Runtime dependencies

HyperOffice packages currently have no third-party runtime dependencies.
Cryptographic operations use the Node.js `node:crypto` module (OpenSSL).
