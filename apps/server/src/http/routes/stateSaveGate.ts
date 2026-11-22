/**
 * stateSaveGate — how many saves of a learner's state one server process handles at the same time: a few at
 * once, a line behind them, and 429 past that.
 *
 * Why: one saved state is limited (512 KB, D-120), and so are one learner's saves for one activity (60 a minute),
 *      but a save of the largest size needs about 10 MB while it is read and stored (measured, D-134: the form
 *      parser makes several copies of the body, the database client more), and nothing bounded how many were in
 *      flight at the same moment. A save takes milliseconds, so the line is short-lived.
 * Spec: H5P-005, NFR-002
 * Invariants:
 *   - The turn is taken before the body is read, so a waiting save holds no body in memory, and is given back
 *     when the response closes, however the request ends.
 *   - A save past the places and the line is answered 429 `hvl:rate-limited` with `Retry-After`, like a save past
 *     the per-minute limit; the player's autosave ignores it and saves again later.
 *   - A client that left while it waited is not read.
 * Collaborators: ../../infra/BoundedGate.ts, ./userDataRoutes.ts (mounts it), ../h5pRouteLimits.ts.
 * Tests: apps/server/test/http/stateSaveGate.test.ts
 */
import type { RequestHandler } from 'express';
import { BoundedGate, GateBusyError, type GateLimits } from '../../infra/BoundedGate.js';
import { refuseWhenLimited } from '../h5pRouteLimits.js';

/** D-134's limits: eight saves at once (about 90 MB at the largest size), two hundred waiting. */
export const STATE_SAVE_GATE_LIMITS: GateLimits = { atOnce: 8, waiting: 200 };

/** What a refused save is told to wait, in seconds. */
export const STATE_SAVE_RETRY_AFTER_SECONDS = 1;

/**
 * Middleware that lets a save go on when a place is free.
 * @param limits - Places and line length; D-134's limits outside tests.
 * @returns Express middleware for the save route, before its body parser.
 */
export function stateSaveTurn(limits: GateLimits = STATE_SAVE_GATE_LIMITS): RequestHandler {
  const gate = new BoundedGate(limits);
  return (_req, res, next) => {
    const turn = (): Promise<void> =>
      new Promise((done) => {
        // WHY: a client that left while it waited has nothing to read; its place goes to the next.
        if (res.destroyed) return done();
        res.once('close', done);
        next();
      });
    gate.run(turn).catch((error: unknown) => {
      try {
        if (!(error instanceof GateBusyError)) throw error;
        refuseWhenLimited({ allowed: false, retryAfterSeconds: STATE_SAVE_RETRY_AFTER_SECONDS }, res);
      } catch (refusal) {
        next(refusal);
      }
    });
  };
}
