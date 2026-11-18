# HyperOffice documentation

Status as of 2026-11-18, commit `392d896` on branch `architecture/hyperoffice-foundation`.

## Is there an installable application or EXE?

**No.** No `.exe`, `.msi`, installer, desktop app, or web app has been produced.
The repository currently contains:

- the monorepo foundation (tooling, CI definitions, governance);
- two command-line tools that run with Node.js (`format-detector`, `development-license-issuer`);
- licensing libraries and the licensing service's business logic (no HTTP server, no database);
- design and planning documents.

Everything is installed and run from source with Node.js and pnpm. See the
[Installation Guide](installation-guide.md). How an EXE will be produced later is
described in [Installation Guide § Packaging](installation-guide.md#packaging-and-executables).

## Document map

| Document | Audience | Purpose |
| --- | --- | --- |
| [Installation Guide](installation-guide.md) | Developers, testers | Prerequisites, install, verify, run, troubleshoot |
| [User Guide (developer & operator)](user-guide.md) | Developers, QA, licensing operators | Day-to-day use of the tools and libraries |
| [End-User Guide](end-user-guide.md) | Customers | What to expect from HyperOffice licensing; product UI not yet built |
| [System Architecture Design](system-architecture-design.md) | Architects, security | Context, components, deployment, data, security architecture |
| [Technical Design Document](technical-design-document.md) | Engineers | Module-level design, algorithms, data model, error model |
| [Functional Specification](functional-specification.md) | Product, QA | Actors, requirements, use cases, business rules, status |
| [API Reference](api-reference.md) | Engineers | Package APIs and the licensing REST contract |
| [Test Report](test-report.md) | QA, release | Actual executed results and coverage gaps |
| [Glossary](glossary.md) | Everyone | Terms and abbreviations |

### Licensing

| Document | Purpose |
| --- | --- |
| [Licensing Guide](licensing/licensing-guide.md) | Single entry point for the licensing system |
| [Commercial model](licensing/commercial-model.md) | Products, editions, terms, expiry behaviour |
| [Feature entitlements](licensing/feature-entitlements.md) | Capability catalogue |
| [Activation code format](licensing/activation-code-format.md) | HO1 code specification |
| [Local verification](licensing/local-verification.md) · [Clock rollback](licensing/clock-rollback.md) · [Renewal flow](licensing/renewal-flow.md) | Client and renewal design |
| [Key management](licensing/key-management.md) · [Extension package signing](licensing/extension-package-signing.md) | Keys, rotation, compromise, extensions |
| [Threat model](licensing/threat-model.md) · [Security test plan](licensing/security-test-plan.md) · [Privacy](licensing/privacy.md) | Security and privacy |
| [Customer support procedures](licensing/customer-support.md) · [Operational runbook](licensing/operational-runbook.md) | Support and operations (pre-deployment) |
| [Implementation backlog](licensing/implementation-backlog.md) | Phase status L0–L8 |

### Architecture records and plans

[Current state](architecture/current-state.md) · [Target state](architecture/target-state.md) ·
[Gap analysis](architecture/gap-analysis.md) · [Backlog](architecture/backlog.md) ·
[ADR index](architecture/decisions/README.md) · [Standards](standards/README.md) ·
[File-processing security](security/file-processing.md) · [REA version](research/rea-version.md)

## Documentation rules

- Documents describe what exists. Planned behaviour is labelled **Planned**.
- Test results are only those actually executed; see the [Test Report](test-report.md).
- No format is claimed above compatibility level L0.
