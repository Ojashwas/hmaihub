# HyperOffice documentation

Status as of 2026-11-19 on branch `architecture/hyperoffice-foundation`.

## Is there an installable application or EXE?

**The apps exist; the installers are not yet built.** The desktop preview
(`apps/desktop`) contains five products — the HyperOffice launcher, HyperDoc,
HyperSheet, HyperDeck, and HyperPlan — and a script that produces one Windows
installer per product (`HyperDoc-Setup-0.1.0.exe`, …).

The installers could not be built on the development workstation: Microsoft
Defender flags the official Electron 45.4.1 runtime as `Trojan:Win32/Cinjo.O!cl`
and blocks it. The detection was not bypassed. Options are in
[Installation Guide § Desktop preview installers](installation-guide.md#desktop-preview-installers).

The repository also contains the CLI tools, licensing libraries, the licensing
service's business logic, and the documents below.

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
