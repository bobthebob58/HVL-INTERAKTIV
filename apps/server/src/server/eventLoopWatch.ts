/**
 * eventLoopWatch — writes one warning line when the server has stood still: when its event loop did not run for a
 * second or more.
 *
 * Why: one long synchronous piece of work stops every request of the process, and nothing in the log said so: the
 *      requests only looked slow. With this line an operator sees that the whole server stood still, when, and for
 *      how long; the request log of the same moment (the request with the long response time) names the work
 *      (NFR-002, D-144). The watch measures with its own clock readings, at every beat and at every check, so the
 *      first check after a standstill finds it whichever timer runs first when the loop runs again (D-153).
 * Spec: NFR-002
 * Invariants:
 *   - One check every `STANDSTILL_CHECK_MS`; a line only when the longest standstill since the last check reached
 *     `STANDSTILL_WARN_MS`, and then one line for that window, however many standstills it held.
 *   - A standstill is how much later than `STANDSTILL_BEAT_MS` the clock was read again; each reading starts the
 *     next measurement, so no standstill is counted twice, and a check counts the time up to itself.
 *   - PRIVACY: the line holds two numbers (the longest standstill and the window, in milliseconds) and nothing of
 *     a request or a person (DATA-009).
 *   - A standstill is written after it has ended. A server that never runs again writes nothing: its health check
 *     gets no answer, and the stack marks it unhealthy (deploy/compose.app.yml).
 *   - Both timers are `unref`'d and `stop()` ends them, so the watch never keeps a stopping server alive.
 * Collaborators: ./main.ts (starts and stops it with the background jobs).
 * Tests: apps/server/test/server/eventLoopWatch.test.ts
 */
import { performance } from 'node:perf_hooks';
import type { Logger } from 'pino';

/** The standstill, in milliseconds, from which a line is written. */
export const STANDSTILL_WARN_MS = 1000;
/** Time between checks, in milliseconds. */
export const STANDSTILL_CHECK_MS = 10_000;
/** Time between the watch's own clock readings, in milliseconds: how finely a standstill is measured. */
export const STANDSTILL_BEAT_MS = 20;

/** When the watch writes and how often it looks. */
export interface EventLoopWatchOptions {
  /** The standstill from which a line is written; `STANDSTILL_WARN_MS` by default. */
  readonly warnMs?: number;
  /** Time between checks; `STANDSTILL_CHECK_MS` by default. */
  readonly checkMs?: number;
}

/** Measures how long the event loop stands still and reports a long standstill once per check. */
export class EventLoopWatch {
  private beat: NodeJS.Timeout | undefined;
  private timer: NodeJS.Timeout | undefined;
  private lastReading = 0;
  private longestMs = 0;
  private readonly warnMs: number;
  private readonly checkMs: number;

  /**
   * @param logger - Receives the warning line.
   * @param options - The limit and the time between checks.
   */
  constructor(
    private readonly logger: Logger,
    options: EventLoopWatchOptions = {},
  ) {
    this.warnMs = options.warnMs ?? STANDSTILL_WARN_MS;
    this.checkMs = options.checkMs ?? STANDSTILL_CHECK_MS;
  }

  /** Starts the measurement and the checks. Calling it twice changes nothing. */
  start(): void {
    if (this.beat) return;
    this.lastReading = performance.now();
    this.longestMs = 0;
    this.beat = setInterval(() => this.measure(), STANDSTILL_BEAT_MS).unref();
    this.timer = setInterval(() => void this.check(), this.checkMs).unref();
  }

  /** Reads the clock: what it shows beyond one beat since the last reading is time the loop did not run. */
  private measure(): void {
    const now = performance.now();
    this.longestMs = Math.max(this.longestMs, now - this.lastReading - STANDSTILL_BEAT_MS);
    this.lastReading = now;
  }

  /**
   * Reads the longest standstill since the last check and writes the line when it reached the limit.
   * @returns The longest standstill in milliseconds; 0 when the watch is not started.
   */
  check(): number {
    if (!this.beat) return 0;
    // WHY: when the loop runs again after a standstill, this check may run before the beat that would have measured
    // it; reading the clock here makes the order of the two timers irrelevant.
    this.measure();
    const standstillMs = Math.round(this.longestMs);
    this.longestMs = 0;
    if (standstillMs >= this.warnMs)
      this.logger.warn(
        { standstillMs, withinMs: this.checkMs },
        'the server stood still: its event loop did not run',
      );
    return standstillMs;
  }

  /** Stops the checks and the measurement. */
  stop(): void {
    clearInterval(this.beat);
    clearInterval(this.timer);
    this.beat = undefined;
    this.timer = undefined;
  }
}
