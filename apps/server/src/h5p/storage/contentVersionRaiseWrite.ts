/**
 * contentVersionRaiseWrite — tells the content storage that the editor save running now starts a new version of an
 * activity while its learner state is kept, so the storage's first parameter write of that activity raises the
 * version in the same statement.
 *
 * Why: a save that changes an answer key starts a new content version, so insight never shows answers judged
 *      against the old key next to the new one (D-137). The learners' saved progress still fits the activity, so
 *      nothing is deleted: this is not the reset of ./learnerStateResetWrite.ts. The raise must commit with the new
 *      parameters or not at all: a page rendered in between must carry a version that matches the key it shows.
 *      Lumi passes no extra argument to the storage, so the mark travels in the save's async context, as
 *      ./learnerStateResetWrite.ts does.
 * Spec: PROD-013, INS-003
 * Invariants:
 *   - Only a write inside `withContentVersionRaise`, of exactly the marked activity, claims the raise, and only
 *     once: Lumi's second ("dirty") write of the same save does not raise the version again.
 *   - Concurrent saves never see each other's marks.
 * Collaborators: ../../learningDesign/safeEditing/LearnerStateGate.ts (marks), ./contentUpdate.ts (claims).
 * Tests: apps/server/test/h5p/contentVersionRaiseWrite.test.ts,
 *   apps/server/test/learningDesign/safeEditing/answerKeyVersions.int.test.ts
 */
import { AsyncLocalStorage } from 'node:async_hooks';

interface RaiseMark {
  readonly contentId: string;
  claimed: boolean;
}

const current = new AsyncLocalStorage<RaiseMark>();

/**
 * Runs an editor save whose first parameter write of `contentId` must also raise the activity's version.
 * @param contentId - The activity whose version the save raises.
 * @param run - The save, e.g. Lumi's `saveOrUpdateContentReturnMetaData`.
 * @returns What `run` returned, and whether the storage claimed the raise (false: the caller raises it itself).
 * @example
 * const { result, claimed } = await withContentVersionRaise(id, () => lumiSave());
 * if (!claimed) await store.raiseVersion(id);
 */
export async function withContentVersionRaise<T>(
  contentId: string,
  run: () => Promise<T>,
): Promise<{ readonly result: T; readonly claimed: boolean }> {
  const mark: RaiseMark = { contentId, claimed: false };
  const result = await current.run(mark, run);
  return { result, claimed: mark.claimed };
}

/**
 * Claims the raise for a write of `contentId`, if the running save marked it and nobody claimed it yet.
 * @param contentId - The activity the storage is about to update.
 * @returns True once per marked save: the caller must raise the version with its write.
 */
export function claimContentVersionRaise(contentId: string): boolean {
  const mark = current.getStore();
  // WHY: the editor route may spell the ID in upper case; the storage compares as PostgreSQL does (UUIDs).
  if (!mark || mark.claimed || mark.contentId.toLowerCase() !== contentId.toLowerCase()) return false;
  mark.claimed = true;
  return true;
}
