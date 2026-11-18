# Key management

Summary of key lifecycle; decisions in [ADR-0103](../architecture/decisions/0103-key-vault-managed-hsm-signing.md).

## Key inventory (per environment)

| Purpose | Production | Staging | Development |
| --- | --- | --- | --- |
| Licence signing | Managed HSM, non-exportable | Separate Key Vault key | `.dev-keys/` per machine |
| Code-hash pepper | Key Vault secret | Separate secret | Random per test run |
| Extension publisher root | Offline HSM | — | Development certificates (explicit dev mode) |
| First-party extension signing | Managed HSM | Separate | Local |
| Audit integrity (if signed checkpoints are adopted) | Managed HSM | Separate | Local |

Each key record: kid, purpose, environment, algorithm, allowed operations,
created/activated/retired dates, destruction policy, owner, backup policy.
Schema: `signing_key` table in `services/licensing/migrations/0001_initial.sql`.

## Rotation

1. Generate `next` key in HSM; publish its public key; ship clients containing current + next.
2. Switch the signer to `next` (status `active`); old key becomes `retired` (verify-only).
3. Keep the retired public key in clients until all grants it signed are past `grace_until`.
4. Disable the retired private key; preserve audit evidence; destroy per policy.

Covered by the rotation test in `services/licensing/tests/unit/activation.test.ts`.

## Compromise response

1. Stop signing with the key (disable in HSM).
2. Publish a signed key-state update via an unaffected trust path (next key or root).
3. Release an emergency client update marking the kid `compromised`.
4. Query `license_grant` by kid to identify affected grants; require online recovery.
5. Notify customers per contract and law; preserve read/export access throughout.
6. Record every action in the audit chain; post-incident review.

A compromised kid makes every grant it signed fail with `KEY_NOT_USABLE`;
customers keep data access and re-activate online.
