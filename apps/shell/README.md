# @hyperoffice/app-shell

Status: **preview** · Owner: `@hyperoffice/apps`

Shared building blocks for every HyperOffice desktop app:

| Module | Purpose |
| --- | --- |
| `products.ts` | Product catalogue (names, app IDs, colours, file types). Also used by the main process and packaging. |
| `api.ts` | Types for the sandboxed preload API (`window.hyperoffice`). |
| `shell.ts` | App bar, toolbar, warning/error banners, status bar, New/Open/Save/Save As wiring, dirty tracking. |
| `shell.css` | Base theme shared by all apps. |
