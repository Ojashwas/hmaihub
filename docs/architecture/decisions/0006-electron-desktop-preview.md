# ADR-0006: Electron for the desktop preview

Status: Accepted for preview builds; supersedes ADR-0001's Tauri default only for the preview

## Context

The user requested installable `.exe` files for every product. Tauri 2 (the
target desktop shell) needs Rust and the MSVC build tools, which are not
installed (ADR-0003). Electron can be built with the existing Node toolchain.

## Decision

- `apps/desktop` is an Electron 45 application with one code base and five
  product builds (HyperOffice launcher, HyperDoc, HyperSheet, HyperDeck, HyperPlan),
  selected by a `hyperoffice.product` field in the packaged `package.json`.
- Security baseline: `contextIsolation`, `sandbox`, no `nodeIntegration`, strict
  CSP, navigation and new windows denied, all non-`file://` requests cancelled,
  only the `fullscreen` permission granted, a minimal preload API, IPC models
  validated before serialisation, file paths only from native dialogs, atomic writes.
- File parsing and writing run in the main process (`@hyperoffice/office-formats`);
  the renderer never touches the file system.
- Installers: electron-builder NSIS, per-user, unsigned (preview only).

## Consequences

- Installers are ~100 MB each because every build ships Chromium.
- Unsigned installers trigger SmartScreen warnings; code signing is required before distribution.
- On the development workstation, Microsoft Defender flagged the official Electron
  45.4.1 runtime as `Trojan:Win32/Cinjo.O!cl` (cloud heuristic) and blocked it.
  The detection was not bypassed. Installers are built in CI (`build-desktop.yml`)
  until the security team clears the detection.
- The Tauri decision is revisited before the first production release.
