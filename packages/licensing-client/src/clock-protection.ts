export const DEFAULT_ROLLBACK_TOLERANCE_SECONDS = 600;

export interface TrustedTimeState {
  /** Last time value received from an authenticated licensing-service response. */
  lastTrustedServerTime: number;
  /** Highest wall-clock time accepted on this installation. Persisted in secure storage. */
  highestObservedTime: number;
}

export type ClockIssue = "WALL_CLOCK_BEFORE_TRUSTED_TIME" | "BACKWARD_JUMP_IN_SESSION" | "BEFORE_SIGNED_ISSUE_TIME";

export interface ClockCheck {
  ok: boolean;
  now: number;
  issue?: ClockIssue;
}

export interface ClockSources {
  wallNow: () => number;
  /** Monotonic seconds (e.g. performance.now() / 1000). Never goes backwards within a process. */
  monotonicNow: () => number;
}

/**
 * Detects wall-clock rollback using the persisted highest observed time,
 * the last trusted server time, signed token issue times, and in-session
 * monotonic time. It does not try to prove the time is correct.
 */
export class ClockGuard {
  #state: TrustedTimeState;
  readonly #tolerance: number;
  readonly #sources: ClockSources;
  readonly #sessionWall: number;
  readonly #sessionMono: number;

  constructor(state: TrustedTimeState, sources: ClockSources, tolerance = DEFAULT_ROLLBACK_TOLERANCE_SECONDS) {
    this.#state = { ...state };
    this.#sources = sources;
    this.#tolerance = tolerance;
    this.#sessionWall = sources.wallNow();
    this.#sessionMono = sources.monotonicNow();
  }

  /** @param signedFloor a signed timestamp the clock must not precede, such as the grant's iat. */
  check(signedFloor = 0): ClockCheck {
    const wall = Math.floor(this.#sources.wallNow());
    const floor = Math.max(this.#state.highestObservedTime, this.#state.lastTrustedServerTime);
    if (wall < floor - this.#tolerance) return { ok: false, now: wall, issue: "WALL_CLOCK_BEFORE_TRUSTED_TIME" };
    if (wall < signedFloor - this.#tolerance) return { ok: false, now: wall, issue: "BEFORE_SIGNED_ISSUE_TIME" };
    const expected = this.#sessionWall + (this.#sources.monotonicNow() - this.#sessionMono);
    if (wall < expected - this.#tolerance) return { ok: false, now: wall, issue: "BACKWARD_JUMP_IN_SESSION" };
    if (wall > this.#state.highestObservedTime) this.#state.highestObservedTime = wall;
    return { ok: true, now: Math.max(wall, floor) };
  }

  /**
   * Records time from an authenticated licensing response. This is the
   * supported recovery path after a legitimate clock correction.
   */
  recordTrustedServerTime(serverTime: number): void {
    this.#state = { lastTrustedServerTime: serverTime, highestObservedTime: serverTime };
  }

  state(): TrustedTimeState {
    return { ...this.#state };
  }
}
