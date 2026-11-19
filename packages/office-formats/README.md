# @hyperoffice/office-formats

Status: **experimental** · Owner: `@hyperoffice/engines`

Preview-level readers and writers plus engines used by the desktop editors.

| Module | Capability |
| --- | --- |
| `docx.ts` | Paragraphs, Title/Heading 1/Heading 2, bold/italic/underline, alignment, RTL, tabs, breaks |
| `xlsx.ts` | Sheets, numbers, text, booleans, formulas with cached values |
| `pptx.ts` | Slides with title and bullets; writes complete master/layout/theme |
| `mspdi.ts` | Project XML tasks, durations, finish-to-start links |
| `formula.ts` | Tokenizer, parser, evaluator, 21 functions, cross-sheet refs, cycle detection |
| `schedule.ts` | Critical-path method on a Monday–Friday calendar |
| `xml.ts`, `opc.ts` | DTD-refusing XML parser; bounded OPC reading via `format-detector` limits |

Everything not listed is reported as a load warning and dropped on save; see
the capability manifests in `compatibility/manifests/`. Output is not yet
validated against Microsoft Office.

Tests: `pnpm --filter @hyperoffice/office-formats test`.
