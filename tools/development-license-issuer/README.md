# @hyperoffice/development-license-issuer

Status: **experimental** · Owner: `@hyperoffice/security`

Issues licence grants for local development. Disabled when
`HYPEROFFICE_ENV` is `production` or `staging`.

```powershell
node tools/development-license-issuer/src/cli.ts --installation ins_XXXXXXXXXXXX --device sha256:<43 chars> --products hyperdoc
```

- The private key is generated per machine in `.dev-keys/` (git-ignored, file mode 0600 where supported).
- The public key is written to `.dev-keys/ho-license-dev.public.json` with
  `environment: "development"`. Product trust stores that only accept
  `production` keys reject it.
- Issuer is `https://license.dev.hyperoffice.invalid`, which production builds do not accept.

Never copy a `.dev-keys` key into another environment. Production signing uses
Azure Key Vault / Managed HSM ([ADR-0103](../../docs/architecture/decisions/0103-key-vault-managed-hsm-signing.md)).
