# User Guide (developers, testers, licensing operators)

This guide covers what can be used today. For installation see the
[Installation Guide](installation-guide.md).

## 1. Daily development workflow

| Task | Command |
| --- | --- |
| Run every check | `pnpm check` |
| Tests for one package | `pnpm --filter @hyperoffice/licensing-core test` |
| Single test file | `node --test packages/licensing-core/tests/jws.test.ts` |
| Format files | `pnpm format` |
| Lint / typecheck | `pnpm lint` / `pnpm typecheck` |

Package names: `@hyperoffice/licensing-core`, `@hyperoffice/licensing-client`,
`@hyperoffice/entitlement-sdk`, `@hyperoffice/licensing-service`,
`@hyperoffice/format-detector`, `@hyperoffice/development-license-issuer`.

Branch and commit conventions: [CONTRIBUTING.md](../CONTRIBUTING.md).

## 2. Format detector

```powershell
node tools/format-detector/src/cli.ts <file>
```

Example (real output):

```json
{
  "format": "docx",
  "level": "L0",
  "mediaType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "evidence": [
    "[Content_Types].xml present",
    "officeDocument relationship -> /word/document.xml",
    "main part content type application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
  ],
  "warnings": [],
  "parts": ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]
}
```

### Reading the result

| Field | Meaning |
| --- | --- |
| `format` | `docx`, `docm`, `dotx`, `dotm`, `xlsx`, `xlsm`, `xltx`, `xltm`, `pptx`, `pptm`, `potx`, `potm`, `ppsx`, `ppsm`, `mspdi`, `ole-compound`, `opc-unknown`, `zip`, `pdf`, `rtf`, `unknown` |
| `level` | Always `L0` (detection only) |
| `evidence` | Why the format was chosen |
| `parts` | ZIP entry names (OOXML only) |

| Warning | Meaning | Suggested action |
| --- | --- | --- |
| `MACROS_PRESENT` | Contains `vbaProject.bin` | Macros are never executed; flag to the user |
| `ENCRYPTED_ENTRIES` | ZIP entries flagged encrypted | Unsupported at L0 |
| `EXTENSION_MISMATCH` | File name extension disagrees with content | Treat as suspicious (possible spoofing) |
| `AMBIGUOUS_MAIN_PART` | More than one main document type | Treat as suspicious |
| `LEGACY_OR_ENCRYPTED_CONTAINER` | OLE file: legacy `.doc/.xls/.ppt/.mpp` or password-protected OOXML | Not classified further at L0 |

### Rejected files

Unsafe files produce exit code `1` and:

```json
{ "rejected": true, "code": "PATH_TRAVERSAL", "message": "…" }
```

Codes: `NOT_A_ZIP`, `TRUNCATED`, `ZIP64_UNSUPPORTED`, `MULTI_DISK_UNSUPPORTED`,
`TOO_MANY_ENTRIES`, `ENTRY_TOO_LARGE`, `PACKAGE_TOO_LARGE`, `ZIP_BOMB_SUSPECTED`,
`PATH_TRAVERSAL`, `DUPLICATE_ENTRY`, `UNSUPPORTED_COMPRESSION`, `SIZE_MISMATCH`,
`DTD_NOT_ALLOWED`. Limits: [file-processing.md](security/file-processing.md).

### Regenerating fixtures

```powershell
node tools/format-detector/scripts/generate-fixtures.ts
```

Writes `compatibility/fixtures/**`. Commit the result together with the change
to `tools/format-detector/src/fixtures.ts`.

## 3. Capability manifests

Each supported format has a JSON file in `compatibility/manifests/`, validated
by `schemas/hyperoffice/capability-manifest.schema.json` in the format-detector tests.

To add or raise a claim:

1. Copy an existing manifest and set `format`, `product`, `extensions`, `mediaType`.
2. Set each capability's `supported` and `level`.
3. List real test files in `testCoverage` (the test suite checks they exist).
4. For `roundTripLevel` L5/L6 you must add `reaInvestigations` paths and a
   `compatibilityReport`; the schema rejects the manifest otherwise.
5. Run `pnpm --filter @hyperoffice/format-detector test`.

## 4. Development licences

```powershell
node tools/development-license-issuer/src/cli.ts --installation <ins_…> --device <sha256:…> `
  [--products hyperdoc,hypersheet] [--features documents.edit,office.export] [--months 6] [--key-dir .dev-keys]
```

- stderr: `kid=ho-license-dev-<12 hex> expires=<ISO date> (development key, not trusted by product builds)`
- stdout: the compact JWS grant.
- Public key: `.dev-keys/ho-license-dev.public.json` (`environment: "development"`).
- Issuer `https://license.dev.hyperoffice.invalid`, audience `hyperoffice-desktop`.

Verify it in code:

```ts
import { evaluateGrant, trustedKeySetFromJwks } from "@hyperoffice/licensing-core";
const keys = trustedKeySetFromJwks(publicKeySet.keys, ["development"]);
const result = evaluateGrant(token, {
  trustedKeys: keys,
  expectedIssuer: "https://license.dev.hyperoffice.invalid",
  expectedAudience: "hyperoffice-desktop",
  product: "hyperdoc",
  installationId: "ins_…",
  deviceBinding: "sha256:…",
  now: Math.floor(Date.now() / 1000)
});
// result.status === "ALLOWED"
```

Never copy `.dev-keys` between machines or into any shared location.

## 5. Using the feature gate in product code

```ts
import { createEntitlements } from "@hyperoffice/entitlement-sdk";
const entitlements = createEntitlements(() => currentLicenseSnapshot);

const decision = entitlements.require("documents.edit");
if (!decision.allowed) showLicenceMessage(decision.status);

entitlements.assert("office.export.pdf"); // throws EntitlementError in services/workers
```

Rules: always call the gate in the application service, not only in the UI;
never gate `*.open`, `*.copy`, or `*.export.open_format` — they are always allowed.
Catalogue: [feature-entitlements.md](licensing/feature-entitlements.md).

## 6. Licensing service use cases (operators, test environments only)

The service has no HTTP endpoint or admin portal yet. Operations are callable
from code/tests:

| Operation | Function | Notes |
| --- | --- | --- |
| Issue codes | `issueCodes(deps, cmd)` | Plaintext returned once; above 50 codes needs a second approver |
| Activate | `activateLicense(deps, cmd)` | Requires `Idempotency-Key`; retries return the same result |
| Renew / add feature | `renewLicense(deps, cmd)` | Presented grant may be expired |

See `services/licensing/tests/helpers.ts` for a complete in-memory setup.

## 7. Test vectors

Regenerate after changing the grant format:

```powershell
node packages/licensing-core/test-vectors/generate.ts
```

The EdDSA vector is deterministic (RFC 8032 test key); ES256 is regenerated
with a fresh key whose private part is discarded.

## 8. REA investigations

Follow [research/rea/README.md](../research/rea/README.md). Written authorisation
(`authorization.md`) is mandatory before any investigation starts.
