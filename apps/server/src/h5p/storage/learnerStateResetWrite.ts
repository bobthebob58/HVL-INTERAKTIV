/**
 * learnerStateResetWrite — tells the content storage that the editor save running now resets an activity's learner
 * state, so the storage's first parameter write of that activity resets it in the same transaction.
 *
 * Why: a structural save deletes the activity's state rows and raises its version (D-093). Lumi's save commits the
 *      parameters in its first write and then copies files and may write again (ContentStorer.addOrUpdateContent); a
 *      reset run as a separate step afterwards could fail, or never run, after the new structure was committed, and
 *      no later save would see the difference again (D-093 amendment 2026-10-29, S5 review). Lumi passes no extra
 *      argument to the storage, so the mark travels in the save's async context, as ./contentCreations.ts does.
 * Spec: PROD-013
 * Invariants:
 *   - Only a write inside `withLearnerStateReset`, of exactly the marked activity, claims the reset, and only once:
 *     Lumi's second ("dirty") write of the same save does not raise the version again.
 *   - Concurrent saves never see each other's marks.
 * Collaborators: ../../learningDesign/safeEditing/LearnerStateGate.ts (marks), ./PrismaContentStorage.ts (claims).
 * Tests: apps/server/test/h5p/learnerStateResetWrite.test.ts,
 *   apps/server/test/learningDesign/safeEditing/safeEditingFailures.int.test.ts
 */
import { AsyncLocalStorage } from 'node:async_hooks';

interface ResetMark {
  readonly contentId: string;
  claimed: boolean;
}

const current = new AsyncLocalStorage<ResetMark>();

/**
 * Runs an editor save whose first parameter write of `contentId` must also reset the activity's learner state.
 * @param contentId - The activity whose state the save resets.
 * @param run - The save, e.g. Lumi's `saveOrUpdateContentReturnMetaData`.
 * @returns What `run` returned, and whether the storage claimed the reset (false: the caller resets it itself).
 * @example
 * const { result, claimed } = await withLearnerStateReset(id, () => lumiSave());
 * if (!claimed) await store.resetLearnerState(id);
 */
export async function withLearnerStateReset<T>(
  contentId: string,
  run: () => Promise<T>,
): Promise<{ readonly result: T; readonly claimed: boolean }> {
  const mark: ResetMark = { contentId, claimed: false };
  const result = await current.run(mark, run);
  return { result, claimed: mark.claimed };
}

/**
 * Claims the reset for a write of `contentId`, if the running save marked it and nobody claimed it yet.
 * @param contentId - The activity the storage is about to update.
 * @returns True once per marked save: the caller must reset the state in the same transaction as its write.
 */
export function claimLearnerStateReset(contentId: string): boolean {
  const mark = current.getStore();
  // WHY: the editor route may spell the ID in upper case; the storage compares as PostgreSQL does (UUIDs).
  if (!mark || mark.claimed || mark.contentId.toLowerCase() !== contentId.toLowerCase()) return false;
  mark.claimed = true;
  return true;
}
