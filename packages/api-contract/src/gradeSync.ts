/**
 * gradeSync — what authors see of the scores sent to the Canvas gradebook, per placement of an activity, and the
 * request that sends failed scores again.
 *
 * Why: LTI-012's acceptance lets authors see a sync status and retry failed jobs. D-104 shows the counts sent,
 *      pending, failed and orphaned per placement, on the activity page and in `/app/play`; who may see a placement
 *      follows D-106, and the counts are not k-suppressed (spec 05 §3), since Canvas's gradebook shows each learner's
 *      score anyway. D-105 has the view say that the scores are formative.
 * Spec: LTI-012, LTI-013
 * Invariants:
 *   - Counts are of jobs (one per attempt with a gradable result, D-115), never of named learners; no learner key,
 *     Canvas user ID or score is in any answer.
 *   - A retry names one placement; orphaned jobs are never retried, and a failed job whose encrypted Canvas user ID
 *     is gone (30 days after it stopped, D-104) stays failed and is counted as such.
 * Collaborators: ./routes/gradeBridgeRoutes.ts, apps/server (the status and retry routes, step 3), apps/web.
 * Tests: packages/api-contract/test/gradeSyncSchemas.test.ts
 */
import { z } from 'zod';

/** How a placement's score is chosen from a learner's attempts (LTI-012). */
export const attemptPolicySchema = z.enum(['best', 'latest', 'mastery']);
/** An attempt policy. */
export type AttemptPolicy = z.infer<typeof attemptPolicySchema>;

/** The mastery threshold when the author set none (LTI-012). */
export const DEFAULT_MASTERY_THRESHOLD = 0.8;

const jobCount = z.int().min(0);

/** A placement's jobs by state; `sent` are the jobs Canvas accepted. */
export const gradeSyncCountsSchema = z.strictObject({
  sent: jobCount,
  pending: jobCount,
  failed: jobCount,
  /** The assignment is gone from Canvas; these are never retried (D-104). */
  orphaned: jobCount,
});
/** Job counts by state. */
export type GradeSyncCounts = z.infer<typeof gradeSyncCountsSchema>;

/** One placement of the activity in a Canvas course, with its grade sync. */
export const gradeSyncPlacementSchema = z.strictObject({
  placementId: z.uuid(),
  /** The platform's name from `LTI_PLATFORMS`, e.g. «HVL Canvas». */
  platformName: z.string(),
  /** The course label from the launch (`LtiPlacement.contextLabel`, e.g. `SYK110`), or null. */
  contextLabel: z.string().nullable(),
  /** False when the placement has no gradebook column (no line item), so nothing is sent. */
  graded: z.boolean(),
  attemptPolicy: attemptPolicySchema,
  /** The scaled score that counts as mastery (default 0.8) for `mastery`; null for the other policies. */
  masteryThreshold: z.number().min(0).max(1).nullable(),
  counts: gradeSyncCountsSchema,
});
/** One placement's grade sync. */
export type GradeSyncPlacement = z.infer<typeof gradeSyncPlacementSchema>;

/**
 * `GET /api/content/:contentId/grade-sync` → 200: the placements the person may see, oldest first: all of them for
 * the activity's owner and co-authors, those of the launch's course for a Canvas author (D-106).
 */
export const gradeSyncStatusResponseSchema = z.strictObject({
  contentId: z.uuid(),
  placements: z.array(gradeSyncPlacementSchema),
});
/** The grade sync of an activity. */
export type GradeSyncStatusResponse = z.infer<typeof gradeSyncStatusResponseSchema>;

/** `POST /api/content/:contentId/grade-sync/retry` body: the placement whose failed jobs are sent again. */
export const gradeSyncRetryRequestSchema = z.strictObject({ placementId: z.uuid() });
/** A retry request. */
export type GradeSyncRetryRequest = z.infer<typeof gradeSyncRetryRequestSchema>;

/** `POST …/grade-sync/retry` → 200: how many failed jobs are pending again, and how many must stay failed. */
export const gradeSyncRetryResponseSchema = z.strictObject({
  requeued: jobCount,
  /** Failed jobs that can no longer be sent: their encrypted Canvas user ID was removed (D-104). */
  stillFailed: jobCount,
});
/** A retry's outcome. */
export type GradeSyncRetryResponse = z.infer<typeof gradeSyncRetryResponseSchema>;
