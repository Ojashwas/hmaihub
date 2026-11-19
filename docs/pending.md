# Pending work and handover checklist

Last updated: 2026-11-19 · Branch `architecture/hyperoffice-foundation` · Latest commit `cbb1ffb`
(not pushed to any remote).

Use this file to continue on another machine. Tick items as you complete them and
commit the updated file.

---

## 1. Move the repository to the new machine

The repository has no remote yet. Transfer it with a Git bundle (keeps full
history, excludes `node_modules` and build output).

On the current machine, in the `hyperoffice` folder:

```powershell
git bundle create ..\hyperoffice.bundle --all
```

Copy `hyperoffice.bundle` to the new machine, then:

```powershell
git clone hyperoffice.bundle hyperoffice
cd hyperoffice
git checkout architecture/hyperoffice-foundation
```

Do **not** copy `node_modules`, `apps/desktop/dist`, `apps/desktop/.stage`,
`apps/desktop/build`, or `.dev-keys` — they are machine-specific and regenerated.

Clone to a **local folder outside OneDrive** (for example `C:\dev\hyperoffice`).

- [ ] Repository cloned on the new machine

## 2. Prepare the new machine

| Requirement | Check | Notes |
| --- | --- | --- |
| Windows 10/11 x64 | — | Installers are Windows-only for now |
| Git | `git --version` | |
| Node.js ≥ 26.12.1 | `node --version` | Required: packages are TypeScript run directly by Node |
| pnpm 12.21.0 | `npm install --global pnpm@12.21.0` | Or prefix commands with `npx --yes pnpm@12.21.0` |
| Internet access to npm and GitHub releases | — | Electron is downloaded from GitHub on first use |
| Antivirus allows Electron 45.4.1 | — | See §3 |

If the network inspects TLS (corporate proxy), set this in every PowerShell
session before installing or building:

```powershell
$env:NODE_OPTIONS = "--use-system-ca"
```

- [ ] Prerequisites installed

## 3. Check the antivirus situation first

On the original machine Microsoft Defender flagged the official Electron 45.4.1
runtime (`electron.exe`) as `Trojan:Win32/Cinjo.O!cl` and deleted it. Nothing was
bypassed. Before building, confirm one of:

- [ ] The new machine's security policy allows Electron (security team confirmed), **or**
- [ ] The detection has been reviewed and cleared as a false positive, **or**
- [ ] You will build in CI instead (§7) or switch to Tauri (§9, item P-12)

Do not add Defender exclusions or disable protection without your security team's approval.

## 4. Install and verify

```powershell
pnpm install
pnpm check            # formatting, lint, typecheck, all tests
```

Expected: `Tasks: 14 successful, 14 total` for tests; no lint or type errors.
Last recorded result: 212 tests, 0 failures.

- [ ] `pnpm install` succeeded
- [ ] `pnpm check` passed (record the test count here: ______)

## 5. Smoke-test the desktop apps

```powershell
pnpm --filter @hyperoffice/desktop smoke
```

This downloads Electron (first run), opens all five windows headlessly, and
round-trips a sample document through every editor and through file save/load.

Expected output: `SMOKE OK: suite, hyperdoc, hypersheet, hyperdeck, hyperplan; editor and file round-trips passed`

- [ ] Smoke test passed
- [ ] If it failed, paste the `SMOKE FAIL` lines into an issue and stop before packaging

To run the suite interactively instead: `pnpm --filter @hyperoffice/desktop start`.

## 6. Build the installers

```powershell
pnpm --filter @hyperoffice/desktop package                 # all five
pnpm --filter @hyperoffice/desktop package hyperdoc        # or selected products
```

Output in `exe\`:

- [ ] `exe\HyperOffice-Setup-0.1.0.exe`
- [ ] `exe\HyperDoc-Setup-0.1.0.exe`
- [ ] `exe\HyperSheet-Setup-0.1.0.exe`
- [ ] `exe\HyperDeck-Setup-0.1.0.exe`
- [ ] `exe\HyperPlan-Setup-0.1.0.exe`

Installers are about 100 MB each, unsigned, and not committed to Git.
Intermediate files go to `%USERPROFILE%\HyperOffice-release`; delete it afterwards if space is needed.

## 7. Alternative: build in CI

1. Create a GitHub repository and push: `git remote add origin <url>` then `git push -u origin architecture/hyperoffice-foundation`.
2. Run **Actions → Build desktop → Run workflow**.
3. Download the `hyperoffice-preview-installers` artifact.

- [ ] Branch pushed
- [ ] `CI`, `Security`, and `Build desktop` workflows green
- [ ] Installers downloaded and scanned

## 8. Manual test after installing

Install each `.exe` (per-user; SmartScreen will warn because it is unsigned →
*More info → Run anyway* only for your own build). Record results.

**HyperOffice launcher**
- [ ] Starts; four tiles shown; each tile opens its app

**HyperDoc**
- [ ] Type text; Title / Heading 1 / Heading 2; bold, italic, underline; alignment; RTL paragraph with Arabic text
- [ ] Save as `.docx`, close, reopen — content identical
- [ ] Open the saved file in **Microsoft Word** — record what renders correctly: ______
- [ ] Open a real Word document with images/tables — warning banner lists unsupported content; Save prompts for Save As

**HyperSheet**
- [ ] Enter numbers and formulas (`=SUM(A1:A3)`, `=IF(A1>5,"big","small")`, `=Sheet2!A1*2`); add/rename/delete sheets
- [ ] Circular reference shows `#CYCLE!`
- [ ] Save `.xlsx`, reopen — values and formulas identical
- [ ] Open the saved file in **Microsoft Excel** — record results: ______

**HyperDeck**
- [ ] Add, duplicate, delete, reorder slides; RTL slide; Present (F5), arrows, Esc
- [ ] Save `.pptx`, reopen — slides identical
- [ ] Open the saved file in **Microsoft PowerPoint** (generated master/layout/theme have never been validated) — record results: ______

**HyperPlan**
- [ ] Add tasks, durations, predecessors; Gantt and critical path update; loop shows an error
- [ ] Save Project XML, reopen — identical
- [ ] Import the saved XML in **Microsoft Project** — record results: ______

**General**
- [ ] Closing with unsaved changes asks for confirmation
- [ ] File type associations: double-clicking a `.docx`/`.xlsx`/`.pptx` offers the HyperOffice app
- [ ] Uninstall from Settings → Apps removes each app

Update `docs/test-report.md` and the capability manifests in
`compatibility/manifests/` with what you observed. A format may only be raised
to L5 after an approved REA investigation (P-05).

---

## 9. Outstanding work items

Status key: ☐ open · ◐ partly done

| ID | Item | Status | Where | Notes |
| --- | --- | --- | --- | --- |
| P-01 | Build the five Windows installers | ☐ | §5–§7 | Blocked on original machine by Defender |
| P-02 | Run the extended smoke test (editor + file round-trips) | ☐ | §5 | Never run successfully; first smoke (windows only) passed |
| P-03 | Validate saved files in Word, Excel, PowerPoint, Project | ☐ | §8 | Required before any compatibility claim above L4 |
| P-04 | Security review of the Defender detection on Electron 45.4.1 | ☐ | §3 | Submit to Microsoft if confirmed false positive |
| P-05 | REA investigations (one per product) with written authorisation | ☐ | `research/rea/README.md` | Needs licensed Office reference machine and an approver; REA pinned at `rea-agents@6.9.0` |
| P-06 | Code-signing certificate and signed installers | ☐ | `apps/desktop/scripts/package.ts` | Required before distributing outside the team |
| P-07 | Push to GitHub; run CI, CodeQL, dependency review | ☐ | `.github/workflows` | Workflows have never run |
| P-08 | Enforce licensing in the desktop apps | ☐ | `packages/entitlement-sdk`, `packages/licensing-client` | Preview apps currently ignore licensing |
| P-09 | Platform secure storage for licences (DPAPI/Keychain/Secret Service) | ☐ | `packages/licensing-client` | Licensing phase L3 |
| P-10 | Licensing HTTP API, PostgreSQL adapter, Key Vault signer | ☐ | `services/licensing` | Phases L2/L5; decide backend framework (ADR-0005) first |
| P-11 | Install Rust toolchain; start `crates/office-package` | ☐ | ADR-0003 | `cargo build`/`cargo test` acceptance items not met |
| P-12 | Decide Electron vs Tauri for production | ☐ | ADR-0006 | Tauri avoids shipping Chromium; needs Rust + MSVC Build Tools |
| P-13 | macOS and Linux packages | ☐ | `apps/desktop/scripts/package.ts` | Not configured |
| P-14 | Broaden format support (tables, images, styles, charts, notes, resources…) | ☐ | `packages/office-formats` | See known-loss lists in `compatibility/manifests/*.json` |
| P-15 | Package-inspection CLI (`inspect`, `validate`, `normalize`, `diff`) | ☐ | `tools/` | Phase 1 |
| P-16 | English and Arabic licensing disclosures (translator + legal review) | ☐ | `docs/licensing/commercial-model.md` | Required for UAE sale |
| P-17 | Legal choice of outbound licence | ☐ | `LICENSE` | Currently "all rights reserved, pending" |
| P-18 | Accessibility testing (axe-core, screen reader) of the apps | ☐ | `apps/*` | WCAG 2.2 AA target |
| P-19 | Update `docs/test-report.md` with results from this checklist | ☐ | `docs/test-report.md` | Last full report predates the app restructure |
| P-20 | Licensing security review and external penetration test | ☐ | `docs/licensing/security-test-plan.md` | Before any production code issuance |

Full backlogs: [architecture/backlog.md](architecture/backlog.md) ·
[licensing/implementation-backlog.md](licensing/implementation-backlog.md) ·
[architecture/gap-analysis.md](architecture/gap-analysis.md).

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `fetch failed` / `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` while downloading Electron | `$env:NODE_OPTIONS = "--use-system-ca"` |
| `ERR_PNPM_IGNORED_BUILDS` | Builds are approved in `pnpm-workspace.yaml` (`allowBuilds`); use pnpm 12.21.0 |
| `Electron failed to install correctly` | Network or antivirus blocked the download; see §3 |
| `…contains a virus or potentially unwanted software` | Antivirus detection; stop and follow §3 |
| `SyntaxError` on `.ts` files | Node is older than 26.12.1 |
| Very slow install | Repository is inside OneDrive; move it to a local folder |
