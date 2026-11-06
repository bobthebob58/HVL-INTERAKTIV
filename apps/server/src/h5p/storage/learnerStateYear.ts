/**
 * learnerStateYear — carries the academic year of the learner's pseudonym secret from the state route to the state
 * write, so each `H5PUserData` row stores the year its `learnerKey` belongs to.
 *
 * Why: the yearly purge deletes learner rows by their stored year (DATA-003, D-107). Without it, the row takes the
 *      database default, the year of the write, which is wrong for a portal session made before 1 August and used up
 *      to 12 hours after (D-057): its key is the old year's, so its state would outlive that year's purge by a year.
 *      Lumi's ContentUserDataManager sits between the route and the storage and passes no extra argument, so the year
 *      travels in the request's async context, as ./stateWriteVersion.ts carries the page's version.
 * Spec: DATA-003, DATA-002, H5P-005
 * Invariants:
 *   - Only writes inside `withLearnerKeyYear` see a year, each its own; concurrent requests never see each other's.
 *   - Without a year (an actor built without a principal) the write keeps the database default, as before.
 * Collaborators: ../../http/routes/userDataRoutes.ts (sets it from the H5P actor), ./learnerStateWrites.ts (reads
 *   it), ../../auth/principalToH5pActor.ts (puts the year on the actor).
 * Tests: apps/server/test/privacy/purge/learnerStateYear.int.test.ts
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const current = new AsyncLocalStorage<number>();

/**
 * Runs a state write whose row stores the given academic year.
 * @param year - The year of the secret behind the learner's key (`HvlH5pActor.learnerKeyYear`); undefined leaves the
 *   database default.
 * @param run - The write, e.g. Lumi's `createOrUpdateContentUserData`.
 * @returns What `run` returns.
 * @example
 * await withLearnerKeyYear(actor.learnerKeyYear, () => manager.createOrUpdateContentUserData(…));
 * @spec DATA-003
 */
export function withLearnerKeyYear<T>(year: number | undefined, run: () => Promise<T>): Promise<T> {
  return year === undefined ? run() : current.run(year, run);
}

/**
 * The academic year the current state write stores, if it runs inside `withLearnerKeyYear`.
 * @returns The year, or undefined for a write outside it.
 * @spec DATA-003
 */
export const learnerKeyYearOfWrite = (): number | undefined => current.getStore();
