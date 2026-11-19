# @hyperoffice/desktop

Status: **preview** · Owner: `@hyperoffice/apps`

Electron host that packages each app folder into its own Windows installer.
The apps themselves live next to this folder:

| Folder | Installer | Product |
| --- | --- | --- |
| `apps/hyperoffice` | `HyperOffice-Setup-0.1.0.exe` | Suite launcher (opens the four apps) |
| `apps/hyperdoc` | `HyperDoc-Setup-0.1.0.exe` | Documents (.docx; opens .docm/.dotx) |
| `apps/hypersheet` | `HyperSheet-Setup-0.1.0.exe` | Spreadsheets (.xlsx; opens .xlsm/.xltx) |
| `apps/hyperdeck` | `HyperDeck-Setup-0.1.0.exe` | Presentations (.pptx; opens .pptm/.potx/.ppsx) |
| `apps/hyperplan` | `HyperPlan-Setup-0.1.0.exe` | Project plans (Microsoft Project XML) |
| `apps/shell` | — | Shared UI used by all apps |

This folder contains only the host: `src/main` (window, menus, file dialogs, IPC),
`src/preload` (sandboxed bridge), `src/renderer` (entry that mounts the right app),
and `scripts` (bundle, icons, smoke test, packaging).

## Commands

```powershell
pnpm --filter @hyperoffice/desktop test      # unit tests (no Electron needed)
pnpm --filter @hyperoffice/desktop build     # bundle to dist/ and generate icons
pnpm --filter @hyperoffice/desktop start     # run the suite in development
pnpm --filter @hyperoffice/desktop smoke     # headless: open all windows, round-trip every editor
pnpm --filter @hyperoffice/desktop package   # build all installers (or pass product ids)
```

Final installers are copied to the repository's `exe/` folder (override with
`HYPEROFFICE_EXE_DIR`). Build intermediates go to `%USERPROFILE%\HyperOffice-release`
(override with `HYPEROFFICE_RELEASE_DIR`), outside synced folders.

Behind a TLS-inspecting corporate proxy, run Node with the Windows certificate
store: `$env:NODE_OPTIONS = "--use-system-ca"`.

## Security model

See [ADR-0006](../../docs/architecture/decisions/0006-electron-desktop-preview.md).
Sandboxed renderer, no Node integration, strict CSP, no network access, file I/O
only in the main process through native dialogs, IPC models validated.
