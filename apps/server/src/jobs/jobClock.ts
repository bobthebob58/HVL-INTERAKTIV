/**
 * jobClock — the clock a timed job reads once per tick, so a test can run the job at any moment it names.
 *
 * Why: the grade worker's backoff and 24-hour limit (D-104) and the yearly purge's 31 August and academic year
 *      (D-107) depend on the date; their tests must travel in time (`DATA-003`'s Verify) without waiting or faking
 *      the process's timers. ./LeasedIntervalJob.ts reads the clock once per tick and hands that moment to the work.
 * Spec: LTI-012, DATA-003
 * Invariants:
 *   - A clock has no side effects; `systemClock` is the only one outside tests.
 * Collaborators: ./LeasedIntervalJob.ts.
 * Tests: apps/server/test/jobs/LeasedIntervalJob.test.ts
 */

/** The current moment; `systemClock` outside tests. */
export type JobClock = () => Date;

/** The system clock. */
export const systemClock: JobClock = () => new Date();
