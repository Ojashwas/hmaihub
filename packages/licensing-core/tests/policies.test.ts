import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";
import { addCalendarMonthsUtc, addTerm, computeGraceUntil, computeRenewalWindow } from "../src/index.ts";

const utc = (iso: string) => Date.parse(iso) / 1000;
const iso = (s: number) => new Date(s * 1000).toISOString();

describe("six-calendar-month expiry", () => {
  const cases: [string, string][] = [
    ["2026-01-15T09:30:00.000Z", "2026-07-15T09:30:00.000Z"],
    ["2026-08-31T23:59:59.000Z", "2027-02-28T23:59:59.000Z"],
    ["2027-08-31T00:00:00.000Z", "2028-02-29T00:00:00.000Z"],
    ["2027-08-29T12:00:00.000Z", "2028-02-29T12:00:00.000Z"],
    ["2026-12-31T10:00:00.000Z", "2027-06-30T10:00:00.000Z"],
    ["2028-02-29T08:00:00.000Z", "2028-08-29T08:00:00.000Z"],
    ["2026-07-31T00:00:00.000Z", "2027-01-31T00:00:00.000Z"],
    // Spans EU (29 Mar) and US (8 Mar) DST changes; UTC arithmetic keeps wall-clock UTC time.
    ["2026-01-01T00:30:00.000Z", "2026-07-01T00:30:00.000Z"]
  ];
  for (const [start, expected] of cases) {
    it(`${start} -> ${expected}`, () => assert.equal(iso(addCalendarMonthsUtc(utc(start), 6)), expected));
  }

  it("is independent of the host time zone", () => {
    const original = process.env["TZ"];
    try {
      process.env["TZ"] = "Asia/Dubai";
      assert.equal(iso(addCalendarMonthsUtc(utc("2026-08-31T22:00:00Z"), 6)), "2027-02-28T22:00:00.000Z");
    } finally {
      if (original === undefined) delete process.env["TZ"];
      else process.env["TZ"] = original;
    }
  });

  it("fixed-day policy adds exactly 183 days", () => {
    assert.equal(
      addTerm(utc("2026-01-01T00:00:00Z"), { unit: "days", length: 183 }) - utc("2026-01-01T00:00:00Z"),
      183 * 86_400
    );
  });

  it("rejects invalid inputs", () => {
    assert.throws(() => addCalendarMonthsUtc(-1, 6), RangeError);
    assert.throws(() => addCalendarMonthsUtc(1.5, 6), RangeError);
    assert.throws(() => addCalendarMonthsUtc(0, -1), RangeError);
  });

  it("property: result is later, within 5..7 x 31 days, and preserves time of day", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_000_000_000 }), fc.integer({ min: 1, max: 24 }), (start, months) => {
        const end = addCalendarMonthsUtc(start, months);
        assert.ok(end > start);
        assert.ok(end - start >= months * 28 * 86_400 && end - start <= months * 31 * 86_400);
        assert.equal(end % 86_400, start % 86_400);
        const s = new Date(start * 1000);
        const e = new Date(end * 1000);
        assert.equal((e.getUTCFullYear() - s.getUTCFullYear()) * 12 + e.getUTCMonth() - s.getUTCMonth(), months);
        assert.ok(e.getUTCDate() <= s.getUTCDate());
      })
    );
  });
});

describe("grace period", () => {
  it("adds 14 days by default policy", () => {
    assert.equal(computeGraceUntil(1000, 14), 1000 + 14 * 86_400);
    assert.throws(() => computeGraceUntil(1000, -1), RangeError);
  });
});

describe("renewal window", () => {
  const term = { unit: "months", length: 6 } as const;

  it("early renewal keeps remaining time", () => {
    const currentExpiry = utc("2027-03-21T14:13:20Z");
    const w = computeRenewalWindow({
      policy: "max-current-expiry-or-now",
      term,
      currentExpiry,
      serverNow: utc("2027-02-01T00:00:00Z")
    });
    assert.equal(iso(w.start), "2027-03-21T14:13:20.000Z");
    assert.equal(iso(w.expiry), "2027-09-21T14:13:20.000Z");
  });

  it("late renewal starts from server time", () => {
    const w = computeRenewalWindow({
      policy: "max-current-expiry-or-now",
      term,
      currentExpiry: utc("2027-03-21T14:13:20Z"),
      serverNow: utc("2027-05-10T08:00:00Z")
    });
    assert.equal(iso(w.expiry), "2027-11-10T08:00:00.000Z");
  });

  it("month-end and leap-year renewal clamps correctly", () => {
    const w = computeRenewalWindow({
      policy: "max-current-expiry-or-now",
      term,
      currentExpiry: utc("2027-08-31T00:00:00Z"),
      serverNow: utc("2027-08-01T00:00:00Z")
    });
    assert.equal(iso(w.expiry), "2028-02-29T00:00:00.000Z");
  });

  it("supports explicit alternative policies", () => {
    const base = { term, currentExpiry: utc("2027-03-01T00:00:00Z"), serverNow: utc("2027-02-01T00:00:00Z") };
    assert.equal(iso(computeRenewalWindow({ ...base, policy: "current-expiry" }).expiry), "2027-09-01T00:00:00.000Z");
    assert.equal(
      iso(computeRenewalWindow({ ...base, policy: "purchase-date", purchaseDate: utc("2027-01-15T00:00:00Z") }).expiry),
      "2027-07-15T00:00:00.000Z"
    );
    assert.equal(
      iso(computeRenewalWindow({ ...base, policy: "co-terminate", coTerminateAt: utc("2027-12-31T23:59:59Z") }).expiry),
      "2027-12-31T23:59:59.000Z"
    );
    assert.throws(() => computeRenewalWindow({ ...base, policy: "activation-date" }), RangeError);
  });

  it("property: default policy never shortens the current entitlement", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3_000_000_000 }),
        fc.integer({ min: 0, max: 3_000_000_000 }),
        (exp, now) => {
          const w = computeRenewalWindow({
            policy: "max-current-expiry-or-now",
            term,
            currentExpiry: exp,
            serverNow: now
          });
          assert.ok(w.expiry > exp && w.expiry > now);
        }
      )
    );
  });
});
