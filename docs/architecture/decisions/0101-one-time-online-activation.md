# ADR-0101: One-time online activation with offline-verifiable grants

Status: Accepted

## Context

Customers buy a term (default six months). They must be able to work offline
after activation, and an outage of the licensing service must not disable
already activated installations.

## Decision

- The client contacts `POST /v1/activations` once with an activation code.
- The server returns a signed licence grant (JWS) bound to the installation and
  device fingerprint, with exact `iat`, `nbf`, `exp`, and `grace_until`.
- The client verifies the grant offline at launch and before licensed feature use,
  using public keys embedded in the build.
- Renewal requires a Renewal Code and one further connection; the server issues
  a replacement grant with a higher `license_version`.
- The service never authorises individual feature invocations.

## Consequences

- An installed grant **cannot be revoked immediately**. Revocation, refunds, and
  chargebacks take effect at the next server contact (renewal, re-activation, or
  an online security update). This limitation is disclosed in the commercial terms.
- Clock manipulation is the main offline attack; mitigated by
  [clock-rollback.md](../../licensing/clock-rollback.md), not eliminated.
- Activation must be idempotent so that timeouts never consume extra activations.
