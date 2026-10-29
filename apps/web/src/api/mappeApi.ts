/**
 * mappeApi — typed calls of the pedagogisk mappe routes: the activities to pick from, the criteria sets, the
 * word-count preview and the Markdown or PDF export.
 *
 * Why: the `/mappe` page (MAPPE-001) picks activities, announces the Del 1 word count from the preview (MAPPE-002) and
 *      downloads the export, which is a file answer (D-099) the server never stores (MAPPE-003). The server checks
 *      every right and limit again.
 * Spec: MAPPE-001, MAPPE-002, DOC-012
 * Invariants:
 *   - Only `import type` from the contract, so zod stays out of the browser bundle.
 *   - The export is a POST with the CSRF token, answered as a file kept only in the result (`apiFileRequest`).
 * Collaborators: ./apiRequest.ts, apps/server/src/learningDesign/http/mappeRoutes.ts, ../features/mappe/.
 * Tests: apps/web/test/features/MappeView.test.tsx, apps/web/test/features/MappeDownloads.test.tsx
 */
import type {
  MappeActivityList,
  MappeCriteriaSetList,
  MappeExportQuery,
  MappePreview,
  MappeRequest,
} from '@hvl-interaktiv/api-contract';
import { apiFileRequest, apiRequest, type ApiAuth, type ApiFileResult, type ApiResult } from './apiRequest';

/** The media type each export format answers with (D-099). */
const FORMAT_MEDIA_TYPE: Readonly<Record<MappeExportQuery['format'], string>> = {
  md: 'text/markdown',
  pdf: 'application/pdf',
};

/**
 * The activities the author can pick: their own and co-authored ones, newest change first.
 * @param auth - The credential.
 * @returns The list.
 */
export const getMappeActivities = (auth: ApiAuth): Promise<ApiResult<MappeActivityList>> =>
  apiRequest<MappeActivityList>('/api/mappe/activities', auth);

/**
 * The criteria sets and the default one.
 * @param auth - The credential.
 * @returns The sets, or 409 `hvl:mappe-not-ready` while the mappe files are not in the content yet.
 */
export const getMappeCriteriaSets = (auth: ApiAuth): Promise<ApiResult<MappeCriteriaSetList>> =>
  apiRequest<MappeCriteriaSetList>('/api/mappe/criteria-sets', auth);

/**
 * The word count of the portfolio the request would make.
 * @param body - The chosen activities, the criteria set and the portfolio's language.
 * @param auth - The credential.
 * @returns The counts against the set's limits.
 */
export const previewMappe = (body: MappeRequest, auth: ApiAuth): Promise<ApiResult<MappePreview>> =>
  apiRequest<MappePreview>('/api/mappe/preview', auth, { method: 'POST', body });

/**
 * Makes the portfolio as a file.
 * @param format - `md` or `pdf`.
 * @param body - The chosen activities, the criteria set and the portfolio's language.
 * @param auth - The credential.
 * @returns The file and its name, or the status and error body (503 `hvl:pdf-unavailable` or `hvl:pdf-busy`).
 */
export const exportMappe = (
  format: MappeExportQuery['format'],
  body: MappeRequest,
  auth: ApiAuth,
): Promise<ApiFileResult> =>
  apiFileRequest(`/api/mappe/export?format=${format}`, auth, {
    method: 'POST',
    body,
    accept: FORMAT_MEDIA_TYPE[format],
  });
