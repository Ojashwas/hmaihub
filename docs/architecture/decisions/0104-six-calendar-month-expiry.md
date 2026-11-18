# ADR-0104: Six-calendar-month term with UTC month-end clamping

Status: Accepted

## Decision

- Default policy A (calendar month): `exp = activation + 6 calendar months` in UTC,
  preserving time of day. If the target month is shorter, the day clamps to the
  month's last day (31 Aug → 28/29 Feb).
- Policy B (fixed day, 183 days) is available per template (`term.unit = "days"`).
- The term starts at successful activation unless the template sets a contractual start.
- `grace_until = exp + 14 days` by default; configurable server-side.
- Default renewal: `start = max(current_expiry, server_now)`, `new_expiry = start + term`.

## Consequences

- Chained renewals from a clamped date do not "recover" the original day:
  31 Aug → 28 Feb → 28 Aug. This is the documented behaviour of "calendar
  months from the current expiry" and must be stated in commercial terms.
- All calculations use UTC epoch seconds; daylight-saving changes in any
  local time zone do not affect expiry. Display converts to local time.
- Tested: month-end, leap years, DST-spanning periods, host time-zone
  independence, and property tests on arbitrary dates.
