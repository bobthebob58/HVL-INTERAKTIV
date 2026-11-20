/**
 * contentUpdate — writes an editor save onto an activity row that exists, and only onto one that exists.
 *
 * Why: a save names its activity by ID. When the row was deleted in the meantime, the save must answer "not found".
 *      Creating the row again would give the activity a new owner: whoever saved last. So the owner is set once,
 *      when PrismaContentStorage creates the activity, and no later write touches it (H5P-006).
 * Spec: H5P-004, H5P-006
 * Invariants:
 *   - Never creates a row and never writes `ownerUserId`.
 *   - A save that claimed a learner-state reset (./learnerStateResetWrite.ts) raises `version` and deletes the
 *     activity's state rows in the same transaction as its parameters, or changes nothing (D-093).
 * Collaborators: ./PrismaContentStorage.ts, ./learnerStateResetWrite.ts, ../../infra/prismaClient.ts.
 * Tests: apps/server/test/h5p/contentStorage.int.test.ts, apps/server/test/content/deleteRace.int.test.ts
 */
import type { Prisma } from '../../generated/prisma/client.js';
import type { Database } from '../../infra/prismaClient.js';
import { claimLearnerStateReset } from './learnerStateResetWrite.js';

/** What an editor save replaces on an activity: main library, title, parameters and metadata. */
export type StoredContentUpdate = Pick<
  Prisma.H5PContentUpdateManyMutationInput,
  'mainLibrary' | 'title' | 'params' | 'metadata'
>;

/**
 * Updates an existing activity with what a save stores.
 * @param db - Database client.
 * @param contentId - The activity's ID (a UUID, in any letter case).
 * @param data - The new main library, title, parameters and metadata.
 * @returns False when no activity has this ID; nothing was written then.
 * @example
 * if (!(await updateStoredContent(db, contentId, data))) throw notFound(contentId);
 */
export async function updateStoredContent(
  db: Database,
  contentId: string,
  data: StoredContentUpdate,
): Promise<boolean> {
  const reset = claimLearnerStateReset(contentId);
  // SECURITY: `updateMany`, never an upsert: a save that meets a deleted activity must not bring it back.
  const write = db.h5PContent.updateMany({
    where: { id: contentId },
    // WHY: the version raise is part of the row update, so its lock comes first, as a state write expects (D-093).
    data: reset ? { ...data, version: { increment: 1 } } : data,
  });
  if (!reset) return (await write).count > 0;
  // WHY: a structural save's reset commits with its parameters or not at all (D-093 amendment, S5 review).
  const [updated] = await db.$transaction([write, db.h5PUserData.deleteMany({ where: { contentId } })]);
  return updated.count > 0;
}
