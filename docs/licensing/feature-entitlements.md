# Feature entitlements

Source of truth: [packages/entitlement-sdk/src/capability-map.ts](../../packages/entitlement-sdk/src/capability-map.ts).
Capability identifiers are stable; never rename one — add a new one and deprecate the old.

## Always allowed (data access)

Granted regardless of licence status, including expired, invalid, or unavailable licensing.

| Capability | Product |
| --- | --- |
| `documents.open`, `documents.copy`, `documents.export.open_format` | HyperDoc |
| `spreadsheets.open`, `spreadsheets.copy`, `spreadsheets.export.open_format` | HyperSheet |
| `presentations.open`, `presentations.copy`, `presentations.export.open_format` | HyperDeck |
| `projects.open`, `projects.copy`, `projects.export.open_format` | HyperPlan |

## Licensed

Require status `ALLOWED` or `GRACE_PERIOD`, the product (or `hyperoffice-suite`),
and one of the listed grant features.

| Capability | Product | Grant feature(s) |
| --- | --- | --- |
| `documents.edit` | HyperDoc | `documents.edit` |
| `spreadsheets.edit` | HyperSheet | `spreadsheets.edit` |
| `spreadsheets.formulas` | HyperSheet | `spreadsheets.formulas` |
| `presentations.edit` | HyperDeck | `presentations.edit` |
| `projects.edit` | HyperPlan | `projects.edit` |
| `projects.schedule` | HyperPlan | `projects.schedule` |
| `projects.critical_path` | HyperPlan | `projects.schedule` |
| `office.import` | any | `office.import` |
| `office.export` | any | `office.export` |
| `office.export.pdf` | any | `office.pdf_export` |
| `office.legacy_format_import` | any | `office.legacy_format_import` |
| `hyperdoc.advanced_layout` | HyperDoc | same |
| `hyperdoc.track_changes` | HyperDoc | same |
| `hypersheet.advanced_formulas` | HyperSheet | same |
| `hypersheet.pivot_editing` | HyperSheet | same |
| `hyperdeck.advanced_animation` | HyperDeck | same |
| `hyperplan.resource_leveling` | HyperPlan | same |
| `hyperplan.earned_value` | HyperPlan | same |
| `collaboration.realtime` | any | same |
| `ai.generate` | HyperAI | `ai.standard` or `ai.enterprise` |
| `ai.enterprise` | HyperAI | same |

## Decision results

`ALLOWED`, `GRACE_PERIOD` (allowed), or a denial with status `NOT_ENTITLED`,
`EXPIRED`, `INVALID_SIGNATURE`, `WRONG_INSTALLATION`, `NOT_YET_VALID`,
`UNSUPPORTED_LICENSE_VERSION`, `CLOCK_TAMPER_SUSPECTED`,
`LICENSING_COMPONENT_UNAVAILABLE`, and a reason (`ENTITLED`,
`DATA_ACCESS_ALWAYS_ALLOWED`, `PRODUCT_NOT_LICENSED`, `FEATURE_NOT_LICENSED`,
`LICENSE_NOT_USABLE`, `NO_LICENSE_STATE`, `UNKNOWN_CAPABILITY`).

## Enforcement points

UI (discoverability only) · application service · server API · conversion
worker · extension host. A UI-only check is a defect.
