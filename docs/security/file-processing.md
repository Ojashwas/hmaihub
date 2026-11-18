# File-processing security

Every opened or uploaded file is hostile input.

## Limits implemented in `tools/format-detector`

| Limit | Desktop | Server | Enforced |
| --- | --- | --- | --- |
| Total declared uncompressed size | 1 GiB | 250 MiB | Before any decompression |
| Package entries | 50,000 | 50,000 | Central directory |
| Single part uncompressed | 100 MiB | 100 MiB | Central directory |
| Compression ratio (parts > 1 MiB) | 200:1 | 200:1 | Central directory |
| Entry name length | 1,024 | 1,024 | Central directory |
| Bytes inflated per inspected part | 4 MiB | 4 MiB | `inflateRawSync` `maxOutputLength` |

Also rejected: path traversal (`..`, `.`, absolute, drive letters, backslashes,
NUL), case-insensitive duplicate entries, ZIP64 and multi-disk archives (not
supported at L0), sizes that disagree with the declaration, DTDs/entities in
package XML, and external `officeDocument` relationships (not followed).

Detection never trusts the file name; a mismatched extension is reported as
`EXTENSION_MISMATCH`.

## Limits not yet implemented

XML nesting depth (256), embedded-object nesting (3), conversion timeout (120 s),
worker memory (2 GiB), CSV injection neutralisation, DDE/remote-template/external
data warnings, image dimension limits. These belong to the Rust package/XML
crates and conversion workers.

The values are initial defaults and must be benchmarked before adjustment.
