# @hyperoffice/desktop

Status: **preview** · Owner: `@hyperoffice/apps`

Electron desktop app producing five Windows installers from one code base:

| Installer | Product |
| --- | --- |
| `HyperOffice-Setup-0.1.0.exe` | Suite launcher (opens the four editors) |
| `HyperDoc-Setup-0.1.0.exe` | Documents (.docx; opens .docm/.dotx) |
| `HyperSheet-Setup-0.1.0.exe` | Spreadsheets (.xlsx; opens .xlsm/.xltx) |
| `HyperDeck-Setup-0.1.0.exe` | Presentations (.pptx; opens .pptm/.potx/.ppsx) |
| `HyperPlan-Setup-0.1.0.exe` | Project plans (Microsoft Project XML) |

## Commands

```powershell
pnpm --filter @hyperoffice/desktop test      # unit tests (no Electron needed)
pnpm --filter @hyperoffice/desktop build     # bundle to dist/ and generate icons
pnpm --filter @hyperoffice/desktop start     # run the suite in development
pnpm --filter @hyperoffice/desktop smoke     # headless: open all windows, round-trip every editor
pnpm --filter @hyperoffice/desktop package   # build all installers (or pass product ids)
```

Installers are written to `%USERPROFILE%\HyperOffice-release` (override with
`HYPEROFFICE_RELEASE_DIR`), outside synced folders.

Behind a TLS-inspecting corporate proxy, run Node with the Windows certificate
store: `$env:NODE_OPTIONS = "--use-system-ca"`.

## Security model

See [ADR-0006](../../docs/architecture/decisions/0006-electron-desktop-preview.md).
Sandboxed renderer, no Node integration, strict CSP, no network access, file I/O
only in the main process through native dialogs, IPC models validated.
