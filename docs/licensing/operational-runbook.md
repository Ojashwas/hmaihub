# Licensing operational runbook

> **Pre-deployment draft.** The licensing service is not deployed. This runbook
> defines required procedures and must be validated in a staging environment
> before go-live.

## Service objectives

| Objective | Target |
| --- | --- |
| Monthly availability | 99.9 % |
| Activation p95 | < 1 s excluding billing |
| RPO | ≤ 15 min |
| RTO | ≤ 4 h |

A licensing outage blocks new activations and renewals only; activated
installations keep working offline.

## Monitoring and alerts (to configure in Azure Monitor)

| Alert | Signal |
| --- | --- |
| Code guessing | `ACTIVATION_FAILED` rate per code hash / IP; `RATE_LIMITED` spikes |
| Activation velocity | Many installations per licence in a short window |
| Bulk generation | Any `codes.generate` above threshold |
| Unusual support resets | Resets per agent per day |
| Privileged role changes | Entra ID role assignment events |
| Signing anomalies | Key Vault sign calls not from the service identity; failed signatures |
| Audit interruption | Gap in audit sequence or hash-chain verification failure |
| Synthetic activation | Scheduled activation with **non-production** codes fails |

Never run synthetic activations with real customer codes.

## Routine procedures

| Procedure | Frequency | Steps |
| --- | --- | --- |
| Audit chain verification | Daily | Run `verifyAuditChain` over the day's events; compare with external sink |
| Backup restore test | Quarterly | Point-in-time restore to an isolated server; run read-only checks |
| Key rotation | Per key policy | [key-management.md § Rotation](key-management.md#rotation) |
| Dependency and CVE review | Weekly | Dependabot, `pnpm audit`, CodeQL results |
| Access review | Quarterly | Review all licensing roles; remove unused |

## Incidents

### Database unavailable

Activation returns errors; clients unaffected. Fail over / restore per PITR.
Verify idempotency and nonce tables restored before reopening traffic.

### Key Vault / HSM unavailable

Activations fail and roll back fully (tested). No codes are consumed. Restore
connectivity; clients retry with the same idempotency key.

### Suspected signing-key compromise

Follow [key-management.md § Compromise response](key-management.md#compromise-response).
Declare a security incident; involve Key Custodians and Legal.

### Suspected code leak (bulk export)

Suspend affected codes (status `SUSPENDED`), review audit chain for the export
request ID, reissue codes to legitimate customers.

## Deployment checklist (before first production release)

- [ ] Phases L0–L6 security review complete
- [ ] Managed identity with sign-only permission; no secrets in configuration
- [ ] Soft delete + purge protection on vaults
- [ ] Private endpoints for database and Key Vault
- [ ] TLS 1.2+ on Front Door; WAF rules enabled
- [ ] PITR and geo-backup enabled; restore tested
- [ ] Alerts above configured and tested
- [ ] Penetration test with no open critical/high findings
- [ ] EN/AR disclosures approved
