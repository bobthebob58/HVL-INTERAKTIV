/**
 * eventLoopWatch — writes one warning line when the server has stood still: when its event loop did not run for a
 * second or more.
 *
 * Why: one long synchronous piece of work stops every request of the process, and nothing in the log said so: the
 *      requests only looked slow. With this line an operator sees that the whole server stood still, when, and for
 *      how long; the request log of the same moment (the request with the long response time) names the work
 *      (NFR-002, D-144).
 * Spec: NFR-002
 * Invariants:
 *   - One check every `STANDSTILL_CHECK_MS`; a line only when the longest standstill since the last check reached
 *     `STANDSTILL_WARN_MS`, and then one line for that window, however many standstills it held.
 *   - PRIVACY: the line holds two numbers (the longest standstill and the window, in milliseconds) and nothing of
 *     a request or a person (DATA-009).
 *   - A standstill is written after it has ended. A server that never runs again writes nothing: its health check
 *     gets no answer, and the stack marks it unhealthy (deploy/compose.app.yml).
 *   - The timer is `unref`'d and `stop()` ends the timer and the measurement, so the watch never keeps a stopping
 *     server alive.
 * Collaborators: ./main.ts (starts and stops it with the background jobs).
 * Tests: apps/server/test/server/eventLoopWatch.test.ts
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { Logger } from 'pino';

/** The standstill, in milliseconds, from which a line is written. */
export const STANDSTILL_WARN_MS = 1000;
/** Time between checks, in milliseconds. */
export const STANDSTILL_CHECK_MS = 10_000;

/** When the watch writes and how often it looks. */
export interface EventLoopWatchOptions {
  /** The standstill from which a line is written; `STANDSTILL_WARN_MS` by default. */
  readonly warnMs?: number;
  /** Time between checks; `STANDSTILL_CHECK_MS` by default. */
  readonly checkMs?: number;
}

/** Measures how long the event loop stands still and reports a long standstill once per check. */
export class EventLoopWatch {
  private histogram: ReturnType<typeof monitorEventLoopDelay> | undefined;
  private timer: NodeJS.Timeout | undefined;
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
    if (this.histogram) return;
    // WHY: Node's own delay histogram: a timer every 20 ms, and how late each one ran.
    this.histogram = monitorEventLoopDelay({ resolution: 20 });
    this.histogram.enable();
    this.timer = setInterval(() => void this.check(), this.checkMs).unref();
  }

  /**
   * Reads the longest standstill since the last check and writes the line when it reached the limit.
   * @returns The longest standstill in milliseconds; 0 when the watch is not started.
   */
  check(): number {
    if (!this.histogram) return 0;
    const standstillMs = Math.round(this.histogram.max / 1_000_000);
    this.histogram.reset();
    if (standstillMs >= this.warnMs)
      this.logger.warn(
        { standstillMs, withinMs: this.checkMs },
        'the server stood still: its event loop did not run',
      );
    return standstillMs;
  }

  /** Stops the checks and the measurement. */
  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.histogram?.disable();
    this.histogram = undefined;
  }
}
