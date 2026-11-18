# ADR-0103: Azure Key Vault / Managed HSM for production signing

Status: Accepted, not implemented (Phase L5)

## Decision

- Production licence-signing keys are non-exportable HSM-backed keys in Azure
  Managed HSM (preferred) or Key Vault Premium.
- The licensing service calls the `sign` operation with a managed identity that
  has only the sign permission on the licence key. No raw key material exists in
  source code, environment variables, GitHub secrets, or the database.
- Separate keys and vaults per environment and purpose: production licence,
  staging licence, development licence (local only, `.dev-keys/`), extension
  publisher root, first-party extension signing, and audit integrity.
- The code-hash HMAC pepper is a Key Vault secret read by managed identity.
- Soft delete and purge protection are enabled; key backups follow the HSM
  backup procedure with documented custodians.
- Key Custodian role is separate from Licensing Manager/Operator roles; no
  ordinary administrator can export or use private keys.

## Consequences

- `GrantSigner` is the only signing port. `LocalDevelopmentSigner` refuses
  `staging`/`production` labels.
- Every sign call is logged by Key Vault diagnostics and by the service audit chain.
- Latency of a remote sign call counts against the 1-second p95 activation objective.
