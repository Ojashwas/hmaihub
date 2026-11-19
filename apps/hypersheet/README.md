# HyperSheet

Status: **preview** · Owner: `@hyperoffice/apps`

Spreadsheet for `.xlsx` (opens `.xlsm` and `.xltx`; saves `.xlsx`).

| Folder | Contents |
| --- | --- |
| `src/grid/` | Grid, formula bar, keyboard navigation, sheet tabs, stylesheet |
| `src/cells/` | Formula-bar input parsing |
| `src/calculation-engine`, `formulas`, `workbook`, `worksheet` | Planned areas (empty); the current formula engine is `packages/office-formats/src/formula.ts` |

Supported subset and known losses: `compatibility/manifests/xlsx.json`.

Installer: `exe/HyperSheet-Setup-0.1.0.exe` (built by `apps/desktop`).
