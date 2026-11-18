# Renewal and feature-code flow

`POST /v1/licenses/{license_id}/renewals` with an `Idempotency-Key` header.

```mermaid
sequenceDiagram
  participant C as Client
  participant S as Licensing service
  participant DB as PostgreSQL (SERIALIZABLE)
  participant K as Key Vault
  C->>S: extension_code, current grant (may be expired), installation, fingerprint, nonce
  S->>S: schema, rate limits, verify presented grant (signature, iss, aud, license_id, binding)
  S->>DB: begin
  S->>DB: idempotency lookup, nonce replay check
  S->>DB: licence ACTIVE, installation ACTIVE + same fingerprint
  S->>DB: code by HMAC hash: unredeemed, redeem-by, customer/licence binding, kind, products, edition
  S->>S: compute window (renewal) or merge features/limits (feature)
  S->>K: sign replacement grant (license_version + 1)
  S->>DB: consume code, update licence, record grant with supersedes_jti, idempotency, nonce, audit
  S->>DB: commit
  S-->>C: replacement grant, previous/new expiry
  C->>C: validate, refuse version rollback, write atomically, keep superseded grant
```

## Policies

| Policy | Start | Use |
| --- | --- | --- |
| `max-current-expiry-or-now` (default) | max(current expiry, now) | Never loses remaining time |
| `current-expiry` | current expiry | Strict continuity (may produce past start for late renewals) |
| `purchase-date` | code issue date | Promotional terms |
| `activation-date` | original activation | Anniversary billing |
| `co-terminate` | now → template `coTerminateAt` | Enterprise alignment |

Feature codes: features are unioned; `limits` are increments; an optional term
extends from `max(current expiry, now)`.

The applicable policy must be shown before purchase.

## Failure handling

- All business failures return the same `RENEWAL_FAILED` body; the reason is audited.
- Signing failure rolls back the whole transaction; the code is not consumed.
- Client write failure leaves the previous grant installed (`STORAGE_FAILED`).

## Test coverage

Early, late (after grace), month-end, concurrent single-use, idempotent retry,
wrong customer, wrong code kind, tampered grant, IDOR (path mismatch), feature
merge. See `services/licensing/tests/unit/renewal.test.ts`.
