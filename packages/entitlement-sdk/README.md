# @hyperoffice/entitlement-sdk

Status: **experimental** · Owner: `@hyperoffice/security`

The single place where HyperOffice code asks "may this capability run?".
Do not read licence claims directly from UI components.

```ts
const entitlements = createEntitlements(() => licensingClient.currentSnapshot());
entitlements.require("documents.edit");   // structured decision, never throws
entitlements.assert("office.export.pdf"); // throws EntitlementError (use in services/workers)
```

## Rules

- Capability identifiers are stable; see [src/capability-map.ts](src/capability-map.ts).
- `data-access` capabilities (open, copy, export to an open format) are **always allowed**,
  including when the licence is expired, invalid, or the licensing component is unavailable.
- `licensed` capabilities require status `ALLOWED` or `GRACE_PERIOD`, the product
  (or `hyperoffice-suite`), and at least one of the listed grant features.
- Unknown capabilities fail closed with `UNKNOWN_CAPABILITY`.
- Enforce at the UI (discoverability), application service, server API,
  conversion worker, and extension host. UI hiding alone is not security.

## Tests

`pnpm --filter @hyperoffice/entitlement-sdk test`
