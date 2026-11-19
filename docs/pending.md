# Pending work and handover checklist

Last updated: 2026-11-19 · Branch `architecture/hyperoffice-foundation` · Latest commit `4569fcd`
(not pushed to any remote).

Use this file to continue on another machine. Tick items as you complete them and
commit the updated file.

---

## 0. Read this first

### What exists

| Area | Location | State |
| --- | --- | --- |
| Five desktop apps | `apps/hyperoffice`, `apps/hyperdoc`, `apps/hypersheet`, `apps/hyperdeck`, `apps/hyperplan` | Preview editors, working subset of each format |
| Shared app UI | `apps/shell` | Toolbar, menus, file commands, product catalogue |
| Electron host + packaging | `apps/desktop` | Builds one installer per app into `exe/` |
| File formats, formulas, scheduler | `packages/office-formats` | DOCX/XLSX/PPTX/MSPDI subset, 21 functions, critical path |
| Format detection | `tools/format-detector` | L0 detection with hostile-file limits |
| Licensing | `packages/licensing-*`, `packages/entitlement-sdk`, `services/licensing` | Design + logic with development keys only; not wired into apps |
| Documentation | `docs/` | Start at [README.md](README.md) |

### Rules to keep (agreed during development)

1. **Do not bypass security controls.** If antivirus flags a file, stop and get a security review. No exclusions or disabling protection without approval.
2. **Do not reverse-engineer Microsoft Office binaries.** Work from public specifications (ECMA-376, MS-OI29500, MSPDI). REA (`rea-agents@6.9.0`) is only for authorised investigations recorded under `research/rea/investigations/`.
3. **No compatibility claim above L4** in `compatibility/manifests/*.json` without an REA investigation and a reviewed report. The schema test enforces this.
4. **No production signing keys** in the repository or on developer machines. Development keys live in `.dev-keys/` (git-ignored).
5. **Report only what was actually run.** Update `docs/test-report.md` with real results.
6. **Customer files are never held hostage**: open, copy, and export must always work, whatever the licence state.
7. Commit after each completed item with a Conventional Commit message (`feat(...)`, `fix(...)`, `docs(...)`, `test(...)`).

### Machine-specific lessons from the first machine

- Corporate TLS inspection broke downloads from GitHub: use `$env:NODE_OPTIONS = "--use-system-ca"`. The npm registry worked without it.
- pnpm 12 approves dependency build scripts through `allowBuilds:` in `pnpm-workspace.yaml` (already configured for `electron`, `esbuild`).
- Electron 45 downloads its runtime on first use (`require("electron")`), not during install.
- When filtering test output in PowerShell, use `node --test --test-reporter=tap …`; the default reporter uses Unicode symbols.
- Tests run TypeScript directly with Node 26 (`node --test "tests/**/*.test.ts"`); there is no compile step except for the desktop bundle (`apps/desktop/scripts/build.ts`).

### Prompt for an AI coding assistant on the new machine

Copy this into the assistant (for example GitHub Copilot agent mode) with the repository open:

> Read `docs/pending.md` in full and follow its rules in section 0. Work through
> sections 1–8 in order, then the task cards in section 9 in the order given by
> "Suggested order". Before each task, read the files listed in its card. After
> each task, run `pnpm check`, update the checkboxes and status in
> `docs/pending.md`, update `docs/test-report.md` with real results, and commit.
> Stop and ask me if antivirus blocks anything, if a task needs credentials,
> certificates, a licensed Microsoft Office installation, or legal/security
> approval, or if a result contradicts this file.

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

### Suggested order

1. P-04 → P-02 → P-01 (or P-07 if building in CI) → P-19
2. P-03 (needs licensed Office) → P-05 (needs authorisation) → update manifests
3. P-08 → P-09
4. P-12 decision, then P-11 or P-06
5. P-14, P-15, P-18 (feature work)
6. P-10, P-20 (licensing backend), P-16, P-17 (legal), P-13

### Task cards

#### P-01 Build the five Windows installers
- Depends on: P-04 cleared, P-02 passed.
- Read: `apps/desktop/scripts/package.ts`, `apps/desktop/README.md`.
- Steps: §6.
- Done when: five `*-Setup-0.1.0.exe` files exist in `exe/`, each installs and launches (§8), and `exe/README.md` status line is updated.

#### P-02 Extended smoke test
- Read: `apps/desktop/src/main/main.ts` (`runSmokeTest`), `apps/desktop/src/main/smoke-models.ts`, `apps/desktop/scripts/smoke.ts`.
- Steps: §5.
- If it fails with "editor round-trip changed the model", compare the printed model with `SMOKE_MODELS` and fix the DOM ↔ model code in `apps/<app>/src/editor/*`. If "file round-trip" fails, fix `packages/office-formats/src/<format>.ts` and add a unit test there.
- Done when: `SMOKE OK … round-trips passed`; result recorded in `docs/test-report.md`.

#### P-03 Validate saved files in Microsoft Office
- Needs: a machine with licensed Word, Excel, PowerPoint, Project.
- Steps: create files with each app (§8), open them in the Office app, note anything repaired, missing, or wrong. PowerPoint is the highest risk (generated master/layout/theme in `packages/office-formats/src/pptx.ts` have never been opened by PowerPoint).
- Fix defects in `packages/office-formats/src/*.ts` with a unit test for each.
- Done when: every format opens without a repair prompt, findings recorded in `docs/test-report.md`. Do **not** raise manifests above L4 yet (that needs P-05).

#### P-04 Defender detection review
- Evidence: `Trojan:Win32/Cinjo.O!cl` on `node_modules\.pnpm\electron@45.4.1…\electron\dist\electron.exe`, 2026-11-19, original machine.
- Steps: give the evidence to the security team; they decide on a Microsoft false-positive submission or an approved exception. Alternative: a newer Electron release they approve (update `apps/desktop/package.json`, `pnpm-workspace.yaml` `minimumReleaseAgeExclude`, ADR-0006).
- Done when: written approval exists, or the decision is to use CI (P-07) or Tauri (P-12).

#### P-05 REA investigations
- Read: `research/rea/README.md`, `docs/research/rea-version.md`.
- Needs: written authorisation (`authorization.md`), licensed reference Office, a named approver.
- Steps: one narrow investigation per product (for example `HDOC-PARA-001` paragraph styles, `HSHEET-FORMULA-001` SUM/IF caching, `HDECK-SLIDE-001` minimal slide package, `HPLAN-DEPENDENCY-001` FS links) following the 11-step workflow; link each to a test in `packages/office-formats/tests`.
- Done when: investigations are approved and committed; only then update `compatibility/manifests/*.json` (`reaInvestigations`, `compatibilityReport`, `roundTripLevel`).

#### P-06 Code signing
- Needs: an Authenticode code-signing certificate (organisation-owned; never committed).
- Steps: add electron-builder `win.signtoolOptions` / Azure Trusted Signing to `apps/desktop/scripts/package.ts` reading credentials from the environment or a secure store; sign in CI with secrets held by the security team; update `release.yml` to publish only signed artefacts with an SBOM.
- Done when: installers show the publisher name, SmartScreen reputation established.

#### P-07 Push and run CI
- Steps: §7. Fix any workflow failures (first run of `ci.yml`, `test.yml`, `security.yml`, `build-desktop.yml`).
- Done when: all workflows green on the branch; open a pull request to `main` using `.github/PULL_REQUEST_TEMPLATE.md`.

#### P-08 Enforce licensing in the apps
- Read: `packages/entitlement-sdk/README.md`, `packages/licensing-client/README.md`, `docs/licensing/local-verification.md`, `docs/licensing/feature-entitlements.md`.
- Steps: in `apps/desktop/src/main`, load the stored grant, validate with `validateInstalledLicense`, pass a `LicenseSnapshot` to the renderer; in each app call `entitlements.require("documents.edit")` etc. before editing; show licence status in the status bar; add an Activate dialog that accepts a development grant from `tools/development-license-issuer`.
- Keep: open/copy/export always allowed (rule 6).
- Done when: unlicensed or expired → editing paused, files still open and export; tests cover both.

#### P-09 Secure storage
- Implement `SecureStore` adapters (Windows DPAPI via Electron `safeStorage`, macOS Keychain, Linux Secret Service) in the desktop main process; atomic write (temp + rename). Replace `MemorySecureStore` in product builds.

#### P-10 Licensing backend
- Decide ADR-0005 (backend framework). Then: HTTP adapter for `services/licensing` matching `openapi/licensing.v1.yaml`, PostgreSQL repository applying `migrations/0001_initial.sql`, Azure Key Vault signer (ADR-0103), shared rate limiter. Do not issue production codes before P-20.

#### P-11 Rust toolchain
- Install rustup (stable), `cargo-nextest`, `cargo-deny`, `cargo-audit`; create `Cargo.toml` workspace and `crates/office-package`; port the tests in `tools/format-detector/tests/detect.test.ts`.

#### P-12 Electron vs Tauri
- Compare installer size, Defender behaviour, security model, and effort; record the decision in a new ADR (supersede ADR-0006 if switching).

#### P-13 macOS / Linux packages
- Add `mac` (dmg, notarisation) and `linux` (AppImage/deb) targets to `package.ts`; requires the respective build machines and an Apple Developer ID.

#### P-14 Broader format support
- Pick items from the `knownLosses` lists in `compatibility/manifests/*.json`. For each: model change in `packages/office-formats/src/models.ts`, reader + writer + tests, editor UI in `apps/<app>`, manifest update.

#### P-15 Package-inspection CLI
- Build `hyperoffice inspect|validate|normalize|diff` on `tools/format-detector` and `packages/office-formats`; see `docs/architecture/backlog.md` P1-002…P1-005.

#### P-16 / P-17 Legal and language
- Arabic and English licensing disclosures (qualified translator + legal sign-off); outbound licence decision for `LICENSE`.

#### P-18 Accessibility
- Add axe-core checks to the smoke test windows; manual NVDA/Narrator pass on each app; fix keyboard traps and missing labels.

#### P-19 Test report
- After §4–§8, rewrite `docs/test-report.md` with date, commit, environment, per-package counts, smoke result, Office validation findings.

#### P-20 Licensing security review
- Follow `docs/licensing/security-test-plan.md`; external penetration test; no open critical/high findings before production.

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `fetch failed` / `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` while downloading Electron | `$env:NODE_OPTIONS = "--use-system-ca"` |
| `ERR_PNPM_IGNORED_BUILDS` | Builds are approved in `pnpm-workspace.yaml` (`allowBuilds`); use pnpm 12.21.0 |
| `Electron failed to install correctly` | Network or antivirus blocked the download; see §3 |
| `…contains a virus or potentially unwanted software` | Antivirus detection; stop and follow §3 |
| `SyntaxError` on `.ts` files | Node is older than 26.12.1 |
| Very slow install | Repository is inside OneDrive; move it to a local folder |
