/**
 * ContentDeleter — deletes an activity under its write lock and records who deleted it.
 *
 * Why: a delete and a save of the same activity must not run into each other: one waits for the other, on every
 *      node, so a save never meets a half-deleted activity (D-117). A deleted activity is gone for its owner and
 *      its co-authors alike, so the audit log says who deleted it and whose it was (DATA-007).
 * Spec: H5P-006, PROD-007, DATA-007
 * Invariants:
 *   - The delete holds the same ContentWriteLock as saves and publishes (D-074).
 *   - The editor's delete (`remove`) still decides who may delete and what "not found" is; this class adds no rule.
 *   - One `content.delete` audit event per deleted activity, written after the delete succeeded. Its target is the
 *     activity; its details are the owner's `User.id` and the status the activity had. No title and no other text.
 *   - An ID that is no UUID goes straight to the editor (not found), without a lock.
 * Collaborators: ./ContentWriteLock.ts, ./publishingDeps.ts, ../http/routes/contentRoutes.ts,
 *   ../server/createApp.ts.
 * Tests: apps/server/test/content/deleteRace.int.test.ts
 */
import { isContentUuid } from '../h5p/contentIds.js';
import { IN_PROCESS_WRITE_LOCK } from './ContentWriteLock.js';
import type { PublishingDeps } from './publishingDeps.js';

/** The delete of an activity, as the H5P content route runs it (../http/routes/contentRoutes.ts). */
export interface ContentDeletion {
  /**
   * Deletes an activity while no save or publish of it is running.
   * @param contentId - The activity ID from the request path.
   * @param actorUserId - `User.id` of the person who deletes.
   * @param remove - The editor's delete: it checks the permission and removes the row, the files and the state.
   * @throws HttpError 409 `hvl:content-changed` when a save or a publish holds the activity for longer than the
   *   lock's wait; whatever `remove` throws (403, 404).
   */
  delete(contentId: string, actorUserId: string, remove: () => Promise<void>): Promise<void>;
}

/** The delete on PostgreSQL, with the write lock of the publish flow. */
export class ContentDeleter implements ContentDeletion {
  /** @param deps - The database and the write lock (the same lock as the publish API's and the save gate's). */
  constructor(private readonly deps: Pick<PublishingDeps, 'db' | 'writeLock'>) {}

  /** Runs the delete under the activity's write lock, then writes the audit event. */
  async delete(contentId: string, actorUserId: string, remove: () => Promise<void>): Promise<void> {
    if (!isContentUuid(contentId)) return remove();
    const { db } = this.deps;
    const lock = this.deps.writeLock ?? IN_PROCESS_WRITE_LOCK;
    await lock.hold(contentId, async () => {
      const row = await db.h5PContent.findUnique({
        where: { id: contentId },
        select: { id: true, ownerUserId: true, status: true },
      });
      await remove();
      // WHY: without a row the editor has just answered "not found", so there is nothing to record.
      if (!row) return;
      await db.auditEvent.create({
        data: {
          actorUserId,
          action: 'content.delete',
          targetType: 'H5PContent',
          targetId: row.id,
          // PRIVACY: IDs and a status word only; the title is free text and is not kept (DATA-007).
          details: { ownerUserId: row.ownerUserId, status: row.status },
        },
      });
    });
  }
}
