# HyperDoc

Status: **preview** · Owner: `@hyperoffice/apps`

Word processor for `.docx` (opens `.docm` and `.dotx`; saves `.docx`).

| Folder | Contents |
| --- | --- |
| `src/editor/` | Editable page, toolbar (styles, bold/italic/underline, alignment, RTL), DOM ↔ model conversion |
| `src/document/` | Run-building helpers |
| `src/styles/` | HyperDoc stylesheet |
| `src/ai`, `comments`, `export`, `headers-footers`, `images`, `layout`, `mail-merge`, `pagination`, `references`, `tables`, `track-changes` | Planned areas (empty) |

File reading/writing: `packages/office-formats/src/docx.ts`. Supported subset and
known losses: `compatibility/manifests/docx.json`.

Installer: `exe/HyperDoc-Setup-0.1.0.exe` (built by `apps/desktop`).
