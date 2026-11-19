# HyperPlan

Status: **preview** · Owner: `@hyperoffice/apps`

Project scheduling for Microsoft Project XML (MSPDI).

| Folder | Contents |
| --- | --- |
| `src/editor/` | Task table, Gantt chart, critical-path highlighting, stylesheet |
| `src/tasks/` | Predecessor input parsing |

Scheduling engine: `packages/office-formats/src/schedule.ts` (critical path,
Monday–Friday calendar). Supported subset and known losses:
`compatibility/manifests/mspdi.json`.

Installer: `exe/HyperPlan-Setup-0.1.0.exe` (built by `apps/desktop`).
