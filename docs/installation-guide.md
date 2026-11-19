# Installation Guide

Applies to commit `392d896`. HyperOffice has **no installer or EXE yet**; you
install the source repository and run its tools with Node.js.

## 1. Prerequisites

| Software | Version | Check | Required for |
| --- | --- | --- | --- |
| Git | 2.40+ | `git --version` | Cloning |
| Node.js | **26.12.1 or later** | `node --version` | Everything (runs TypeScript directly) |
| npm | Bundled with Node | `npm --version` | Fetching pnpm |
| pnpm | 12.21.0 | `pnpm --version` | Workspace install and tasks |
| Rust | stable | `cargo --version` | Not used yet (Phase 1) |

Node.js 26 is required because the packages are TypeScript files executed via
Node's built-in type stripping; older Node versions will fail with syntax errors.

Disk: about 150 MB for `node_modules`. Network access to `registry.npmjs.org`
is needed for the first install.

## 2. Get the source

```powershell
git clone <repository-url> hyperoffice
cd hyperoffice
git checkout architecture/hyperoffice-foundation
```

The repository has not been pushed to a remote yet. Until it is, copy the
`hyperoffice` folder (including `.git`).

**Recommended:** keep the clone **outside OneDrive or other sync folders**.
`node_modules` contains thousands of files and links that sync clients handle poorly.

## 3. Install pnpm

Choose one:

```powershell
npm install --global pnpm@12.21.0     # global install
# or, without a global install, prefix every pnpm command:
npx --yes pnpm@12.21.0 --version
```

The rest of this guide writes `pnpm`; replace it with `npx --yes pnpm@12.21.0`
if you did not install globally.

## 4. Install dependencies

```powershell
pnpm install
```

Expected end of output: `Done in …s using pnpm v12.21.0`. Only development
dependencies are installed (TypeScript, ESLint, Prettier, Turborepo, fast-check,
Ajv, Node types). HyperOffice packages have no third-party runtime dependencies.

## 5. Verify the installation

```powershell
pnpm format:check   # "All matched files use Prettier code style!"
pnpm lint           # no output, exit code 0
pnpm typecheck      # no output, exit code 0
pnpm test           # "Tasks: 6 successful, 6 total"
```

Or all at once: `pnpm check`.

Expected test totals (see [Test Report](test-report.md)): 148 tests, 0 failures.

`pnpm test:e2e` **fails on purpose** (no UI exists). `pnpm build` succeeds but
runs no tasks because no package needs compilation yet.

## 6. Run the tools

### Detect a file format

```powershell
node tools/format-detector/src/cli.ts compatibility/fixtures/word/minimal.docx
```

Prints JSON such as `"format": "docx", "level": "L0"`. Exit code `0` = detected
(including `unknown`), `1` = file rejected as unsafe, `2` = usage error.

### Issue a development licence

```powershell
node tools/development-license-issuer/src/cli.ts `
  --installation ins_DEVMACHINE0001 `
  --device sha256:QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ `
  --products hyperdoc
```

Creates `.dev-keys/` (git-ignored) on first use and prints a signed
development grant. Disabled when `HYPEROFFICE_ENV` is `production` or `staging`.

Details: [User Guide](user-guide.md).

## 7. Optional: REA research tool

```powershell
pnpm rea --help        # runs npx --yes rea-agents@6.9.0
```

Only for authorised compatibility research. See [research/rea/README.md](../research/rea/README.md).

## 8. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `SyntaxError` on `import type` or `.ts` file | Node < 26 | Install Node 26.12.1+ |
| `pnpm` not recognised | pnpm not global | Use `npx --yes pnpm@12.21.0 …` |
| `ERR_PNPM_…` lockfile errors | Different pnpm major | Use pnpm 12.21.0 |
| Very slow install, sync icons on files | Clone inside OneDrive | Move the clone to a local folder |
| `Cannot find package '@hyperoffice/…'` | `pnpm install` not run | Run `pnpm install` at the repo root |
| CRLF warnings on `git add` | Windows line endings | Harmless; `.gitattributes` normalises to LF |
| PowerShell blocks `npx`/`pnpm` scripts | Execution policy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (per your organisation's policy) |

## 9. Uninstall

Delete the repository folder. If you ran the development issuer outside the
repo, also delete that `.dev-keys` folder. If you installed pnpm globally:
`npm uninstall --global pnpm`.

## Desktop preview installers

### Build them

```powershell
$env:NODE_OPTIONS = "--use-system-ca"            # only behind a TLS-inspecting proxy
pnpm install
pnpm --filter @hyperoffice/desktop smoke          # opens all 5 windows headlessly, round-trips every editor
pnpm --filter @hyperoffice/desktop package        # all products
pnpm --filter @hyperoffice/desktop package hyperdoc hypersheet   # selected products
```

Output (default `%USERPROFILE%\HyperOffice-release`, override with `HYPEROFFICE_RELEASE_DIR`):

```
HyperOffice-release\suite\HyperOffice-Setup-0.1.0.exe
HyperOffice-release\hyperdoc\HyperDoc-Setup-0.1.0.exe
HyperOffice-release\hypersheet\HyperSheet-Setup-0.1.0.exe
HyperOffice-release\hyperdeck\HyperDeck-Setup-0.1.0.exe
HyperOffice-release\hyperplan\HyperPlan-Setup-0.1.0.exe
```

Each installer is per-user (no administrator rights), lets the user choose the
folder, and creates Start-menu and desktop shortcuts. HyperDoc, HyperSheet, and
HyperDeck register their file types; HyperPlan does not claim `.xml`.

The GitHub Actions workflow `build-desktop.yml` runs the tests, the smoke test,
and the packaging on `windows-latest`, and uploads the installers as the
`hyperoffice-preview-installers` artifact.

### Current blocker on the development workstation

Microsoft Defender detected the official Electron 45.4.1 runtime
(`node_modules\.pnpm\electron@45.4.1…\electron\dist\electron.exe`) as
`Trojan:Win32/Cinjo.O!cl` on 2026-11-19 and blocks every read of the file. The
`!cl` suffix indicates a cloud machine-learning verdict. Nothing was excluded,
disabled, or bypassed. To proceed, choose one:

1. Ask your security team to review the detection and, if they confirm a false
   positive, submit it to Microsoft and restore/allow the file.
2. Build in CI (the workflow above) and have the installers scanned before use.
3. Switch the shell to Tauri 2 (uses the system WebView2 and a small native
   executable); requires Rust and the MSVC build tools.

The first smoke test ran successfully before the detection (all five windows
loaded without renderer errors). The extended smoke test with editor round-trips
has not run yet because of the block.

### Install a built installer

1. Run `HyperDoc-Setup-0.1.0.exe` (or another product).
2. SmartScreen warns because preview installers are **unsigned**: choose
   *More info → Run anyway* only if the file came from your own build or CI.
3. Choose the install folder and finish. Start the app from the Start menu.
4. Uninstall from *Settings → Apps → Installed apps*.

## Packaging and executables

| Deliverable | Technology | Status |
| --- | --- | --- |
| Windows installers for the 5 desktop products | Electron + electron-builder NSIS | Scripts ready; blocked locally by Defender; CI workflow ready |
| Code signing, signed updates | Authenticode certificate | Not started (required before distribution) |
| macOS / Linux packages | electron-builder dmg / AppImage / deb | Not configured |
| Production desktop shell | Tauri 2 (target per ADR-0001) | Revisit before first production release |
| Web app | React + Vite static build | Not started |
| Licensing service | Container image on Azure | Not started |

`release.yml` still refuses to publish: there is no signing or provenance yet.
