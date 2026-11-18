export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Fixed-window limiter. The in-memory store is for a single instance and
 * tests; multi-instance deployments need a shared store (Redis or the gateway).
 */
export class FixedWindowRateLimiter {
  readonly #windows = new Map<string, { start: number; count: number }>();

  peek(key: string, rule: RateLimitRule, now: number): RateLimitDecision {
    const w = this.#windows.get(key);
    if (!w || now - w.start >= rule.windowSeconds) return { allowed: true, retryAfterSeconds: 0 };
    return w.count < rule.limit
      ? { allowed: true, retryAfterSeconds: 0 }
      : { allowed: false, retryAfterSeconds: w.start + rule.windowSeconds - now };
  }

  hit(key: string, rule: RateLimitRule, now: number): RateLimitDecision {
    const decision = this.peek(key, rule, now);
    const w = this.#windows.get(key);
    if (!w || now - w.start >= rule.windowSeconds) this.#windows.set(key, { start: now, count: 1 });
    else w.count++;
    return decision;
  }
}
