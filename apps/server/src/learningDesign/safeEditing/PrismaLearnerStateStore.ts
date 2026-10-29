/**
 * PrismaLearnerStateStore — the learner-state rows the safe-editing gate reads and resets, on PostgreSQL.
 *
 * Why: the gate (./LearnerStateGate.ts) asks whether anyone but the saver has saved progress, and a structural save
 *      resets all of it and raises the activity's version (D-093). The version raise and the deletion are one
 *      transaction whose first statement locks the activity's row: a state write from a learner's page holds that
 *      row in share mode while it checks its version (../../h5p/storage/PrismaContentUserDataStorage.ts), so a
 *      write either lands before the reset (and is deleted by it) or after it (and is dropped as stale).
 * Spec: PROD-013, DATA-002
 * Invariants:
 *   - Reads only whether a row exists (`findFirst` of the ID), never a learnerKey, a count or a state.
 *   - "Someone else" is any row of the activity, in any context, whose learnerKey is not the saver's; without the
 *     saver's key every row counts.
 *   - The reset updates `H5PContent.version` first, then deletes every `H5PUserData` row of the activity.
 * Collaborators: ./LearnerStateGate.ts (the interface), ../../infra/prismaClient.ts, ../../h5p/createH5pRuntime.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/safeEditing.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { LearnerStateStore } from './LearnerStateGate.js';

/** `LearnerStateStore` on PostgreSQL. */
export class PrismaLearnerStateStore implements LearnerStateStore {
  /**
   * @param db - Database client.
   */
  constructor(private readonly db: Database) {}

  /** Whether a state row of the activity belongs to anyone but `ownLearnerKey`. */
  async hasOtherLearnersState(contentId: string, ownLearnerKey: string | undefined): Promise<boolean> {
    const row = await this.db.h5PUserData.findFirst({
      where: { contentId, ...(ownLearnerKey ? { learnerKey: { not: ownLearnerKey } } : {}) },
      select: { id: true },
    });
    return row !== null;
  }

  /** Raises the version and deletes every state row of the activity, in that order, in one transaction. */
  async resetLearnerState(contentId: string): Promise<void> {
    await this.db.$transaction([
      // WHY: first, so its row lock makes a concurrent version-checked state write wait or see the new version.
      this.db.h5PContent.update({ where: { id: contentId }, data: { version: { increment: 1 } } }),
      this.db.h5PUserData.deleteMany({ where: { contentId } }),
    ]);
  }
}
