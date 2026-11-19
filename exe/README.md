# exe — HyperOffice installers

Final Windows installers are written here by:

```powershell
pnpm --filter @hyperoffice/desktop package
```

| Installer | App |
| --- | --- |
| `HyperOffice-Setup-0.1.0.exe` | Suite launcher (opens the four apps) |
| `HyperDoc-Setup-0.1.0.exe` | Documents (.docx) |
| `HyperSheet-Setup-0.1.0.exe` | Spreadsheets (.xlsx) |
| `HyperDeck-Setup-0.1.0.exe` | Presentations (.pptx) |
| `HyperPlan-Setup-0.1.0.exe` | Project plans (Microsoft Project XML) |

The `.exe` files are not committed to Git (about 100 MB each). Preview
installers are unsigned; Windows SmartScreen will warn until code signing is added.

Status: not yet built on the development workstation because Microsoft Defender
blocks the Electron runtime (see `docs/installation-guide.md`). The
`build-desktop.yml` CI workflow produces the same files as a downloadable artifact.
