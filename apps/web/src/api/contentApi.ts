/**
 * contentApi — typed calls of the activity routes: list, detail, findings, publish and unpublish.
 *
 * Why: the start page lists a person's activities and the activity page checks and publishes one (PROD-003). The
 *      server decides every right and validates again on publish (D-074); these functions only carry the requests,
 *      typed by packages/api-contract (D-077).
 * Spec: PROD-003, UD-022, DOC-012
 * Invariants:
 *   - Only `import type` from the contract, so zod stays out of the browser bundle.
 *   - The activity ID is percent-encoded into the path.
 * Collaborators: ./apiRequest.ts, apps/server/src/http/api/contentListRoutes.ts, .../publishRoutes.ts.
 * Tests: apps/web/test/api/apiRequest.test.ts, apps/web/test/components/PublishDialog.test.tsx
 */
import type {
  ContentDetail,
  ContentList,
  FindingsResponse,
  PublishRequest,
  PublishResponse,
  UnpublishRequest,
  UnpublishResponse,
} from '@hvl-interaktiv/api-contract';
import { apiRequest, type ApiAuth, type ApiResult } from './apiRequest';

const contentPath = (contentId: string, rest = ''): string =>
  `/api/content/${encodeURIComponent(contentId)}${rest}`;

/**
 * The person's own and co-authored activities.
 * @param auth - The credential.
 * @returns The list, newest change first.
 */
export const listContent = (auth: ApiAuth): Promise<ApiResult<ContentList>> =>
  apiRequest<ContentList>('/api/content', auth);

/**
 * One activity and what the person may do with it.
 * @param contentId - The activity.
 * @param auth - The credential.
 * @returns The detail, or 404 when the person may not view it.
 */
export const getContent = (contentId: string, auth: ApiAuth): Promise<ApiResult<ContentDetail>> =>
  apiRequest<ContentDetail>(contentPath(contentId), auth);

/**
 * The validator's findings for the stored activity.
 * @param contentId - The activity.
 * @param auth - The credential.
 * @returns The findings and the `updatedAt` they belong to.
 */
export const getFindings = (contentId: string, auth: ApiAuth): Promise<ApiResult<FindingsResponse>> =>
  apiRequest<FindingsResponse>(contentPath(contentId, '/findings'), auth);

/**
 * Publishes the activity, with a reason for each error published despite.
 * @param contentId - The activity.
 * @param body - The `updatedAt` from the findings and the acknowledgements.
 * @param auth - The credential.
 * @returns The new status, or 409 `hvl:publish-blocked` / `hvl:content-changed`.
 */
export const publishContent = (
  contentId: string,
  body: PublishRequest,
  auth: ApiAuth,
): Promise<ApiResult<PublishResponse>> =>
  apiRequest<PublishResponse>(contentPath(contentId, '/publish'), auth, { method: 'POST', body });

/**
 * Returns a published activity to draft.
 * @param contentId - The activity.
 * @param body - The `updatedAt` the author saw.
 * @param auth - The credential.
 * @returns The new status, or 409 `hvl:content-changed`.
 */
export const unpublishContent = (
  contentId: string,
  body: UnpublishRequest,
  auth: ApiAuth,
): Promise<ApiResult<UnpublishResponse>> =>
  apiRequest<UnpublishResponse>(contentPath(contentId, '/unpublish'), auth, { method: 'POST', body });
