/**
 * learnerInfoFields — the part of an activity's learning design that learners see before they start: the estimated
 * minutes and the one-line purpose.
 *
 * Why: PED-032 shows students the time estimate and "why this matters" so they can plan their study. D-087 gives
 *      learners these two fields only, after the View check, in the portal's activity summary
 *      (../../content/contentSummaries.ts) and in the Canvas page's launch header (../../lti/play/appLaunchRoutes.ts).
 *      One reader keeps both answers alike.
 * Spec: PED-032, PED-030
 * Invariants:
 *   - PRIVACY and pedagogy: only `estimatedStudentMinutes` and `learnerPurpose` are selected; never the rationale,
 *     the course code, the outcomes or the pattern, which are the author's (D-087).
 *   - A stored value outside the contract's limits (1–600 whole minutes; one line of 1–200 characters) is left out,
 *     never passed on; an absent value is left out, never `null`.
 *   - A purpose with a control character (Unicode `Cc`, e.g. a pasted tab, which the contract's one-line rule lets
 *     through) is left out too: the Canvas page's strict launch parser (apps/web/src/lti/launchHeader.ts) treats a
 *     launch carrying one as no launch at all, so passing it on would lock every learner out of the activity.
 *   - The callers read these only after the View check; nothing here checks permissions.
 * Collaborators: ../../content/contentSummaries.ts, ../../lti/ltiRoutes.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/metadata/learnerInfo.int.test.ts,
 *   apps/server/test/lti/appLaunchLearnerInfoWiring.int.test.ts
 */
import {
  estimatedStudentMinutesSchema,
  learnerPurposeSchema,
  type LearnerInfo,
} from '@hvl-interaktiv/api-contract';
import type { Database } from '../../infra/prismaClient.js';

const CONTROL_CHARACTER = /\p{Cc}/u;

/** The Prisma `select` of the learner-facing metadata fields, and nothing else. */
export const LEARNER_INFO_SELECT = { estimatedStudentMinutes: true, learnerPurpose: true } as const;

/** The stored learner-facing fields of one activity's metadata. */
export interface StoredLearnerInfo {
  readonly estimatedStudentMinutes: number | null;
  readonly learnerPurpose: string | null;
}

/** What learners see before an activity starts, without its language (the caller adds the activity's own). */
export type LearnerInfoFields = Pick<LearnerInfo, 'estimatedStudentMinutes' | 'learnerPurpose'>;

/**
 * The learner-facing fields of stored metadata.
 * @param row - The stored fields, or null/undefined when the activity has no metadata.
 * @returns The minutes and purpose that are set and within the contract's limits.
 * @spec PED-032
 */
export function learnerInfoFields(row: StoredLearnerInfo | null | undefined): LearnerInfoFields {
  const minutes = estimatedStudentMinutesSchema.safeParse(row?.estimatedStudentMinutes);
  const purpose = learnerPurposeSchema.safeParse(row?.learnerPurpose);
  // WHY: a control character would make the Canvas page refuse the whole launch (see the invariants above).
  const plainPurpose = purpose.success && !CONTROL_CHARACTER.test(purpose.data);
  return {
    ...(minutes.success ? { estimatedStudentMinutes: minutes.data } : {}),
    ...(plainPurpose ? { learnerPurpose: purpose.data } : {}),
  };
}

/**
 * Reads the learner-facing fields of one activity; call it only after the View check.
 * @param db - The database.
 * @param contentId - The canonical activity ID.
 * @returns The minutes and purpose that are set.
 * @spec PED-032
 */
export async function readLearnerInfo(db: Database, contentId: string): Promise<LearnerInfoFields> {
  return learnerInfoFields(
    await db.learningDesignMetadata.findUnique({ where: { contentId }, select: LEARNER_INFO_SELECT }),
  );
}
