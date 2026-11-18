# Security Policy

## Reporting a vulnerability

Do not open public issues for security problems.

Report vulnerabilities privately to the HyperOffice security team
(contact address to be assigned before any public release). Include:

- affected component and version or commit;
- reproduction steps or a minimal proof of concept;
- impact assessment;
- whether the issue is already public.

## Scope highlights

- Every uploaded or opened Office file is treated as hostile input. Parser
  limits are documented in [docs/security/file-processing.md](docs/security/file-processing.md).
- The licensing subsystem uses asymmetric signatures. Production private keys
  live only in Azure Key Vault or Managed HSM. See
  [docs/licensing/threat-model.md](docs/licensing/threat-model.md).
- Never commit secrets, private keys, or `.dev-keys/` contents. These paths are
  ignored by `.gitignore`.

## Supported versions

No version has been released. There are no supported versions yet.
