const SECONDS_PER_DAY = 86_400;

export interface Term {
  unit: "months" | "days";
  length: number;
}

function assertEpoch(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${name} must be a non-negative integer epoch second`);
}

/**
 * Adds calendar months in UTC, keeping the time of day. When the target month
 * is shorter, the day is clamped to its last day (31 Aug + 6 months = 28/29 Feb).
 */
export function addCalendarMonthsUtc(epochSeconds: number, months: number): number {
  assertEpoch(epochSeconds, "epochSeconds");
  if (!Number.isInteger(months) || months < 0 || months > 1200) throw new RangeError("months must be 0..1200");
  const d = new Date(epochSeconds * 1000);
  const monthIndex = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), lastDay);
  return Date.UTC(year, month, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()) / 1000;
}

export function addTerm(start: number, term: Term): number {
  assertEpoch(start, "start");
  if (!Number.isInteger(term.length) || term.length <= 0) throw new RangeError("term length must be positive");
  return term.unit === "months" ? addCalendarMonthsUtc(start, term.length) : start + term.length * SECONDS_PER_DAY;
}

export function computeGraceUntil(expiry: number, graceDays: number): number {
  assertEpoch(expiry, "expiry");
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 365)
    throw new RangeError("graceDays must be 0..365");
  return expiry + graceDays * SECONDS_PER_DAY;
}

export type RenewalStartPolicy =
  "max-current-expiry-or-now" | "current-expiry" | "purchase-date" | "activation-date" | "co-terminate";

export interface RenewalInput {
  policy: RenewalStartPolicy;
  term: Term;
  currentExpiry: number;
  serverNow: number;
  purchaseDate?: number;
  activationDate?: number;
  coTerminateAt?: number;
}

export interface RenewalWindow {
  start: number;
  expiry: number;
}

/** Default policy keeps remaining time: start = max(current expiry, server now). */
export function computeRenewalWindow(input: RenewalInput): RenewalWindow {
  assertEpoch(input.currentExpiry, "currentExpiry");
  assertEpoch(input.serverNow, "serverNow");
  const required = (value: number | undefined, name: string): number => {
    if (value === undefined) throw new RangeError(`${name} is required for policy ${input.policy}`);
    assertEpoch(value, name);
    return value;
  };
  let start: number;
  switch (input.policy) {
    case "max-current-expiry-or-now":
      start = Math.max(input.currentExpiry, input.serverNow);
      break;
    case "current-expiry":
      start = input.currentExpiry;
      break;
    case "purchase-date":
      start = required(input.purchaseDate, "purchaseDate");
      break;
    case "activation-date":
      start = required(input.activationDate, "activationDate");
      break;
    case "co-terminate": {
      const end = required(input.coTerminateAt, "coTerminateAt");
      if (end <= input.serverNow) throw new RangeError("coTerminateAt must be in the future");
      return { start: input.serverNow, expiry: end };
    }
  }
  const expiry = addTerm(start, input.term);
  if (expiry <= input.serverNow) throw new RangeError("Renewal would produce an already-expired licence");
  return { start, expiry };
}
