# Extension package signing design

Status: design (Phase L6). Not implemented.

An **Extension Package** installs executable functionality. It is unrelated to
Activation, Renewal, and Feature Codes.

```
extension-package.zip
├── manifest.json
├── payload/...
├── checksums.json
└── signature.jws
```

## manifest.json

Extension ID, publisher ID, name, version, minimum and maximum tested
HyperOffice versions, capabilities, permissions (capability-based, e.g.
`document.read`, `network.outbound`), entry points, entitlement requirement,
update URL, support URL.

## checksums.json

`{ "algorithm": "sha256", "files": { "<path>": "<base64url digest>" } }` for every
file except `signature.jws`. Paths use `/`, are relative, and are unique
case-insensitively.

## signature.jws

Compact JWS, `typ: HYPEROFFICE-EXTENSION+jws`, header `alg`/`kid`/`x5c` chain
**only** to a configured publisher root. Payload:

```json
{
  "extension_id": "com.example.word-counter",
  "publisher_id": "pub_...",
  "version": "1.2.0",
  "manifest_sha256": "...",
  "checksums_sha256": "...",
  "build_provenance": "slsa:...",
  "iat": 1790000000
}
```

The signature authenticates the publisher; the hashes bind the signature to
every file. SHA-256 alone is never treated as publisher authentication.

## Installation steps

1. Bounded ZIP read (reuse `format-detector` limits): reject traversal, absolute
   paths, duplicate entries, ZIP bombs, symlinks, and encrypted entries.
2. Verify every listed file exists and no unlisted file exists.
3. Recompute SHA-256 of every file and compare.
4. Verify the JWS against HyperOffice publisher certificates, organisation-managed
   trusted publishers, or (development mode only) development certificates.
5. Check extension ID/version match the manifest and are not downgrades.
6. Check the local denylist and the last revocation list from online security updates.
7. Evaluate permissions with the user/administrator.
8. Evaluate the entitlement requirement through `entitlement-sdk`.
9. Content scanning adapter.
10. Install atomically (stage, verify, rename); audit.

## Trust roots

Separate keys: extension publisher root (offline, HSM), first-party extension
signing, organisation publisher certificates. Never reuse licence-signing or TLS keys.
