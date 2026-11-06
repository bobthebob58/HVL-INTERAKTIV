/**
 * gradeSyncApi — typed calls of the grade-sync routes: an activity's placements with their job counts, and the retry
 * of one placement's failed jobs.
 *
 * Why: LTI-012's acceptance has authors see a per-activity sync status and retry failed jobs, on the activity page
 *      and in `/app/play` (D-104). The server decides who sees which placement (D-106); these functions only carry
 *      the requests, typed by packages/api-contract (D-077).
 * Spec: LTI-012, DOC-012
 * Invariants:
 *   - Only `import type` from the contract, so zod stays out of the browser bundle.
 *   - The activity ID is percent-encoded into the path; the placement goes in the body, never the address.
 *   - The credential is the page's: the session and CSRF token in the portal, the Bearer ltik in Canvas (LTI-003).
 * Collaborators: ../../api/apiRequest.ts, ./GradeSyncPanel.tsx,
 *   apps/server/src/grades/status/gradeSyncRoutes.ts.
 * Tests: apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx
 */
import type { GradeSyncRetryResponse, GradeSyncStatusResponse } from '@hvl-interaktiv/api-contract';
import { apiRequest, type ApiAuth, type ApiResult } from '../../api/apiRequest';

const gradeSyncPath = (contentId: string): string =>
  `/api/content/${encodeURIComponent(contentId)}/grade-sync`;

/**
 * The placements of an activity the person may see, with their jobs counted by state.
 * @param contentId - The activity.
 * @param auth - The credential.
 * @returns The status, or 403 (not the person's to see) and 404 (unavailable).
 */
export const getGradeSync = (contentId: string, auth: ApiAuth): Promise<ApiResult<GradeSyncStatusResponse>> =>
  apiRequest<GradeSyncStatusResponse>(gradeSyncPath(contentId), auth);

/**
 * Sends a placement's failed jobs again.
 * @param contentId - The activity.
 * @param placementId - The placement whose failed jobs to requeue.
 * @param auth - The credential.
 * @returns How many are pending again and how many must stay failed, or 429 `hvl:rate-limited`.
 */
export const retryGradeSync = (
  contentId: string,
  placementId: string,
  auth: ApiAuth,
): Promise<ApiResult<GradeSyncRetryResponse>> =>
  apiRequest<GradeSyncRetryResponse>(`${gradeSyncPath(contentId)}/retry`, auth, {
    method: 'POST',
    body: { placementId },
  });
