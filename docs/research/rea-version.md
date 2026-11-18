# REA version record

| Field | Value |
| --- | --- |
| Upstream | https://github.com/morluto/rea |
| Package | `rea-agents` |
| Pinned version | 6.9.0 (latest release on 2026-11-18) |
| Tarball integrity | `sha512-KqDn1UR5BMqHoQ3MGAnPuWiSKwgdFaz1L/uUNgrKt+1W8kPtgYP8AWEOXIF1lDIOBVyPuYIIst2iamo1Wf3r8g==` |
| Licence | MIT |
| Node.js requirement | `^22.23.4 \|\| ^24.22.1 \|\| >=26.12.1` |
| Integration | External tool via `pnpm rea` ([ADR-0004](../architecture/decisions/0004-rea-as-pinned-external-tool.md)) |
| Review status | Pending security review; not yet executed in this repository |
| Pinned by | Foundation setup, 2026-11-18 |

## Installation

```powershell
pnpm rea --help                  # runs npx --yes rea-agents@6.9.0
npm view rea-agents@6.9.0 dist.integrity   # must match the value above
```

Native analysis providers (Ghidra, Hopper, IDA) are optional and only needed
for binary investigations, which require written authorisation.
