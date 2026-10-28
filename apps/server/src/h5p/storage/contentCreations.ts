/**
 * contentCreations — tells a caller which activity rows the content storage created while one operation ran,
 * even when that operation then failed.
 *
 * Why: the duplicator saves its copy through HvlH5PEditor, and Lumi writes the new row before it copies files and
 *      writes the parameters a second time (ContentStorer.addOrUpdateContent). If a later step throws, the save
 *      rejects without the new ID, and the half-made copy would stay behind (D-092 requires that nothing half-done
 *      remains). The storage records each row it creates in the operation's async context, so the caller learns
 *      the ID exactly, without guessing from timestamps or titles, and without another request's rows.
 * Spec: PROD-007, H5P-004
 * Invariants:
 *   - Only creations inside `trackContentCreations` are recorded, and only in that call's own list; concurrent
 *     operations (another save by the same author) never see each other's rows.
 *   - Recording never throws and costs nothing outside a tracked operation.
 * Collaborators: ./PrismaContentStorage.ts (records), ../../learningDesign/collaboration/ContentDuplicator.ts
 *   (tracks its save).
 * Tests: apps/server/test/h5p/contentCreations.test.ts,
 *   apps/server/test/learningDesign/collaboration/ContentDuplicatorFailures.int.test.ts
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const tracked = new AsyncLocalStorage<string[]>();

/**
 * Runs an operation and collects the IDs of the activity rows the content storage creates during it.
 * @param created - The list that receives each new ID, in creation order; it is filled even when `run` rejects.
 * @param run - The operation, e.g. an editor save.
 * @returns What `run` returns.
 * @example
 * const created: string[] = [];
 * try { await trackContentCreations(created, () => editor.saveOrUpdateContent(undefined, …)); }
 * catch (error) { for (const id of created) await removeHalfMadeCopy(id); throw error; }
 */
export function trackContentCreations<T>(created: string[], run: () => Promise<T>): Promise<T> {
  return tracked.run(created, run);
}

/**
 * Records a newly created activity row in the current tracked operation, if any.
 * @param contentId - The new row's ID.
 */
export function noteContentCreated(contentId: string): void {
  tracked.getStore()?.push(contentId);
}
