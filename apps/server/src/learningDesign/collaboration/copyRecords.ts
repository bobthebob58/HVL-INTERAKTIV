/**
 * copyRecords — writes what makes a saved copy a duplicate: its link to the source, the source author's
 * attribution, the learning-design data it may take along, and the audit record, in one transaction.
 *
 * Why: PROD-007 keeps a link to the source and the original author's attribution and never copies learner data;
 *      D-092 lists which learning-design fields travel and which belong to the source's author. Writing them together
 *      means a copy is either fully recorded or (when this fails) removed by the duplicator, never half-recorded.
 * Spec: PROD-007, PED-030, DATA-007
 * Invariants:
 *   - The copy is a private draft owned by the person: status `draft`, visibility `private`, no bank listing and no
 *     publish time are written explicitly, whatever the source had.
 *   - Copied: phase, `patternId`, outcomes (text, category, order), student minutes and learner purpose. The
 *     rationale and the course code only when the person may Edit the source (`via: 'edit'`).
 *   - Never copied: learner state, statements, insight snapshots, placements, acknowledgements, co-authors.
 *     Nothing here reads those tables.
 *   - The audit event names one person, the actor, in its own column; its details hold the source's activity ID, the
 *     route and the kind only (DATA-007), never names, texts or other people's IDs.
 * Collaborators: ./ContentDuplicator.ts (the caller), ./duplicateRules.ts (`DuplicateRoute`),
 *   ../../infra/prismaClient.ts.
 * Tests: apps/server/test/learningDesign/collaboration/ContentDuplicator.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/ContentDuplicatorData.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { DuplicateRoute } from './duplicateRules.js';

/** The audit action of a duplicate. */
export const DUPLICATED_ACTION = 'content.duplicated';

/** Which flow made the copy: «Lag ein kopi» or «Lagre som ny versjon» in the editor (D-093). */
export type CopyKind = 'duplicate' | 'save-as-copy';

/** One made copy, ready to be recorded. */
export interface CopyRecord {
  readonly copyId: string;
  readonly sourceId: string;
  /** `User.id` of the source's owner when the copy was made. */
  readonly sourceAuthorUserId: string;
  /** `User.id` of the person who made the copy (its owner). */
  readonly actorUserId: string;
  readonly via: DuplicateRoute;
  readonly kind: CopyKind;
}

/**
 * Records a copy: link and attribution, the learning-design data D-092 allows, and the audit event.
 * @param db - The server's Prisma client.
 * @param record - The copy and how it was made.
 * @throws the database's error; nothing of the record is then written.
 * @spec PROD-007
 */
export async function recordCopy(db: Database, record: CopyRecord): Promise<void> {
  const { copyId, sourceId, via } = record;
  await db.$transaction(async (tx) => {
    await tx.h5PContent.update({
      where: { id: copyId },
      data: {
        sourceContentId: sourceId,
        sourceAuthorUserId: record.sourceAuthorUserId,
        status: 'draft',
        visibility: 'private',
        bankListedAt: null,
        publishedAt: null,
      },
    });
    const design = await tx.learningDesignMetadata.findUnique({
      where: { contentId: sourceId },
      include: { outcomes: { orderBy: { position: 'asc' } } },
    });
    if (design) {
      // PRIVACY: the rationale and course code are the source author's own planning; a bank copy leaves them (D-092).
      const authorsOwn = via === 'edit';
      await tx.learningDesignMetadata.create({
        data: {
          contentId: copyId,
          phase: design.phase,
          patternId: design.patternId,
          estimatedStudentMinutes: design.estimatedStudentMinutes,
          learnerPurpose: design.learnerPurpose,
          rationale: authorsOwn ? design.rationale : null,
          courseCode: authorsOwn ? design.courseCode : null,
          outcomes: {
            create: design.outcomes.map(({ text, category, position }) => ({ text, category, position })),
          },
        },
      });
    }
    await tx.auditEvent.create({
      data: {
        actorUserId: record.actorUserId,
        action: DUPLICATED_ACTION,
        targetType: 'H5PContent',
        targetId: copyId,
        // PRIVACY: the actor is the only person in the event (its column); details are object IDs and codes (DATA-007).
        details: { sourceContentId: sourceId, via, kind: record.kind },
      },
    });
  });
}
