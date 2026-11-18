# Customer support procedures (licensing)

> **Pre-deployment draft.** Support tooling (admin portal, reset endpoint) does
> not exist yet. Procedures marked *Planned tooling* define the intended process.

## 1. Information to collect

- Support reference `HSR-…` from the error message.
- Order number or licence ID (`lic_…`).
- Licence diagnostics export (status, reason, key ID, licence version, expiry, grant hash).

Never ask for: the activation code by email/chat in clear text, documents, or
screenshots containing documents. Never paste codes or tokens into tickets.

## 2. Triage by status

| Status / error | Likely cause | Action |
| --- | --- | --- |
| `ACTIVATION_FAILED` | Unknown, used, expired, or wrong-product code | Look up the support reference in the audit log; internal reason shows the cause. Confirm order; reissue or replace code (Manager approval) |
| `RATE_LIMITED` | Repeated attempts | Ask customer to wait for `retry_after_seconds`; check fraud flags if repeated |
| `IDEMPOTENCY_CONFLICT` / `REPLAY_DETECTED` | Client bug or replay | Ask customer to retry from the app; escalate to engineering if persistent |
| `WRONG_INSTALLATION` | Licence copied, or major hardware change | Verify ownership; perform support reset (*Planned tooling*) |
| `DEVICE_CHANGED_REQUIRES_RESET` (internal) | Same installation ID, new fingerprint | Support reset after identity check |
| `CLOCK_TAMPER_SUSPECTED` | Clock earlier than a verified time | Ask customer to correct date and choose Verify time online; disconnected sites: signed offline support response (*Planned*) |
| `INVALID_SIGNATURE` | Damaged grant, or key marked compromised | Re-activate; if a key compromise is active, follow the incident communication |
| `UNSUPPORTED_LICENSE_VERSION` | Old app | Update the app |
| `EXPIRED` / `GRACE_PERIOD` | Term ended | Renewal; remind customer files remain accessible |
| `LICENSING_COMPONENT_UNAVAILABLE` | Secure store unreadable | Restart; repair install; escalate with diagnostics |

## 3. Support reset (*Planned tooling*)

1. Verify the requester owns the licence (order email + licence ID).
2. Check reset history; repeated resets within the waiting period require risk review.
3. Deactivate the old installation; the customer re-activates.
4. Record reason; the action is written to the audit chain.

## 4. Refunds and chargebacks

The installed licence keeps working offline until it next contacts the service
(disclosed in terms). Block future renewals on the licence; do not attempt to
disable the customer's files.

## 5. Escalation

Engineering for repeat technical failures; Security for suspected fraud, code
leakage, or key compromise; Legal/Privacy for data requests.
