# @hyperoffice/format-detector

Status: **experimental** · Owner: `@hyperoffice/parsers`

Content-based detection (compatibility level **L0**) for DOCX/DOCM/DOTX/DOTM,
XLSX/XLSM/XLTX/XLTM, PPTX/PPTM/POTX/POTM/PPSX/PPSM, Microsoft Project XML
(MSPDI), OLE compound files, PDF, and RTF.

```powershell
node tools/format-detector/src/cli.ts compatibility/fixtures/word/minimal.docx
```

## Public API

`detectFormat(bytes, { fileName?, limits? })`, `readCentralDirectory`, `readEntry`,
`DESKTOP_LIMITS`, `SERVER_LIMITS`, `PackageSecurityError`, `writeZip` (fixtures/tests),
`MINIMAL_PACKAGES`, `MINIMAL_MSPDI`.

## Behaviour

- Reads the ZIP central directory and enforces limits before inflating anything.
- Main part is found through the `officeDocument` relationship and the
  `[Content_Types].xml` override, falling back to known main-part content types.
- Reports `MACROS_PRESENT`, `ENCRYPTED_ENTRIES`, `EXTENSION_MISMATCH`,
  `AMBIGUOUS_MAIN_PART`, `LEGACY_OR_ENCRYPTED_CONTAINER`.
- OLE files (legacy `.doc/.xls/.ppt/.mpp` or encrypted OOXML) are reported as
  `ole-compound` without further classification.

Limits: [docs/security/file-processing.md](../../docs/security/file-processing.md).
This TypeScript implementation is the behavioural specification for the future
Rust `office-package` crate (ADR-0003).
