/**
 * stateWriteVersion — carries the activity version a learner's page was opened with from the state route to the
 * state storage, and the storage's answer (written, or dropped as stale) back.
 *
 * Why: after a structural save resets learners' progress (D-093), a page opened before it keeps posting the old
 *      state every few seconds; stored, that state would crash or mislead the learner's next visit. The player
 *      therefore sends the version it was rendered with (../../learningDesign/safeEditing/contentVersionOnPages.ts),
 *      and the storage writes only while the activity still has that version, in the same transaction as its
 *      version check (./PrismaContentUserDataStorage.ts). Lumi's ContentUserDataManager sits between the route and
 *      the storage and passes no extra argument, so the version travels in the request's async context, as
 *      ./contentCreations.ts does for created rows.
 * Spec: PROD-013, H5P-005
 * Invariants:
 *   - Only writes inside `withStateWriteVersion` are checked, each against its own version; concurrent requests
 *     never see each other's.
 *   - `stale` is set only by the storage, only when the stored version differs, and the write was then not made.
 * Collaborators: ../../http/routes/userDataRoutes.ts (sets it), ./PrismaContentUserDataStorage.ts (checks it).
 * Tests: apps/server/test/learningDesign/safeEditing/staleStateWrites.int.test.ts
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/** The version a state write expects, and whether the storage dropped it. */
export interface StateWriteExpectation {
  /** The `H5PContent.version` the learner's page was rendered with. */
  readonly version: number;
  /** Set by the storage when the activity's version is no longer `version` and nothing was written. */
  stale: boolean;
}

const current = new AsyncLocalStorage<StateWriteExpectation>();

/**
 * Runs a state write that is valid only while the activity has `version`.
 * @param version - The version the page sent (`contentVersion` in its state URL).
 * @param run - The write, e.g. Lumi's `createOrUpdateContentUserData`.
 * @returns Whether the storage dropped the write as stale.
 * @example
 * const { stale } = await withStateWriteVersion(3, () => manager.createOrUpdateContentUserData(…));
 */
export async function withStateWriteVersion(
  version: number,
  run: () => Promise<unknown>,
): Promise<{ readonly stale: boolean }> {
  const expectation: StateWriteExpectation = { version, stale: false };
  await current.run(expectation, run);
  return { stale: expectation.stale };
}

/**
 * The version the current state write expects, if it runs inside `withStateWriteVersion`.
 * @returns The expectation, or undefined for an unchecked write.
 */
export const stateWriteExpectation = (): StateWriteExpectation | undefined => current.getStore();
