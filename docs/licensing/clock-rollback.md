# Clock-rollback defence

A signed token cannot stop a user changing the system clock. The defence is
layered and aims to make rollback detectable, not impossible.

## Signals

| Signal | Source | Stored |
| --- | --- | --- |
| Highest observed wall-clock time | Every successful check | Secure store |
| Last trusted server time | Authenticated activation/renewal responses | Secure store |
| Signed issue time | Grant `iat` | In the grant |
| Monotonic session time | `performance.now()` | Memory only |
| Signed update timestamps | Future: signed application update manifests | — |

## Rules (`ClockGuard`)

Tolerance: 600 seconds (NTP corrections). Time zones and DST are irrelevant
(UTC epoch seconds).

1. `wall < max(highestObserved, lastTrustedServer) − tolerance` → `WALL_CLOCK_BEFORE_TRUSTED_TIME`.
2. `wall < grant.iat − tolerance` → `BEFORE_SIGNED_ISSUE_TIME`.
3. `wall < sessionStartWall + monotonicElapsed − tolerance` → `BACKWARD_JUMP_IN_SESSION`.
4. Otherwise the time used for expiry is `max(wall, trusted floor)`, so small
   rollbacks inside the tolerance never extend a licence.

Any rule firing turns `ALLOWED`, `GRACE_PERIOD`, `NOT_YET_VALID`, or `EXPIRED`
into `CLOCK_TAMPER_SUSPECTED`. It never turns an invalid grant into a valid one.

## User experience when suspected

- Read, copy, and open-format export remain available.
- Paid modification features are paused.
- Message explains that the system clock appears to be earlier than a previously
  verified time, and offers **Verify time online** (authenticated server time via
  `recordTrustedServerTime`).
- Disconnected enterprise sites: signed offline support response (Phase L4) that
  carries a signed server time for the installation.

## Known gaps

- Wiping the secure store and reinstalling resets local state; the grant's `iat`
  floor and re-activation limits still apply.
- A forward-set clock raises the highest observed time; correcting it requires
  online verification. Support runbook must cover this.
- No unauthenticated NTP is trusted.
