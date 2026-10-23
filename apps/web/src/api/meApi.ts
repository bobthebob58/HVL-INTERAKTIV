/**
 * meApi — typed calls of `GET /api/me` and `PUT /api/me/notices/:noticeId`.
 *
 * Why: the formative-use notice (PROD-011) is dismissed once per user and version, and the server remembers it
 *      (D-075); the web app reads the dismissals from `/api/me` and records a new one with a PUT.
 * Spec: PROD-011, DATA-002
 * Invariants:
 *   - Only `import type` from the contract; the notice ID is one of the contract's `NOTICE_IDS`.
 * Collaborators: ./apiRequest.ts, ../components/Notice.tsx, apps/server/src/http/api/meRoutes.ts.
 * Tests: apps/web/test/components/Notice.test.tsx
 */
import type { Me, NoticeDismissalRequest, NoticeId } from '@hvl-interaktiv/api-contract';
import { apiRequest, type ApiAuth, type ApiResult } from './apiRequest';

/**
 * Who is signed in (mode, language, roles) and which notices they dismissed.
 * @param auth - The credential.
 * @returns The answer, or 401 without a principal.
 */
export const getMe = (auth: ApiAuth): Promise<ApiResult<Me>> => apiRequest<Me>('/api/me', auth);

/**
 * Records that the person dismissed a notice in a given version.
 * @param noticeId - The notice.
 * @param version - The version that was shown.
 * @param auth - The credential.
 * @returns 204 on success.
 */
export const dismissNotice = (
  noticeId: NoticeId,
  version: number,
  auth: ApiAuth,
): Promise<ApiResult<undefined>> =>
  apiRequest<undefined>(`/api/me/notices/${encodeURIComponent(noticeId)}`, auth, {
    method: 'PUT',
    body: { version } satisfies NoticeDismissalRequest,
  });
