# Roadmap

Phases are sequential. A later phase does not start until the earlier phase has a
working vertical slice and an automated quality gate.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Repository foundation, CI, ADRs, capability manifests, REA pin, format detection | In progress |
| 1 | Package inspection: ZIP/OLE abstraction, content types, relationships, XML normalizer, package diff, validation CLI | Not started |
| 2 | Read-only vertical slices for DOCX, XLSX, PPTX, Project XML | Not started |
| 3 | Edit and save, undo/redo, deterministic save | Not started |
| 4 | Conversion graph and sandboxed workers | Not started |
| 5 | Collaboration | Not started |
| 6 | Extensions and Office Add-in subset | Not started |
| 7 | Advanced compatibility | Not started |
| 8 | Enterprise capabilities | Not started |

## Licensing track

| Phase | Scope | Status |
| --- | --- | --- |
| L0 | Threat model, commercial policy, schemas, ADRs, privacy data map | Drafted, awaiting review |
| L1 | Development signing key, local issuer, JWS grant, client verifier, feature gates, tests | Implemented (development keys only) |
| L2 | PostgreSQL model, code generator, activation endpoint, rate limiting, audit | Domain and use cases only; no HTTP or database adapter |
| L3–L8 | See [docs/licensing/implementation-backlog.md](docs/licensing/implementation-backlog.md) | Not started |

No real billing is connected and no production commercial codes may be issued
until L0–L6 pass security review.
