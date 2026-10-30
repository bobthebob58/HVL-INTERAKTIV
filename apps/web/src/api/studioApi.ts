/**
 * studioApi — typed calls of the studio routes: the public overview, guide and pattern detail, and creating an
 * activity from a pattern.
 *
 * Why: the guide, the phase matrix and the catalogue come from `content/` through the Express API as JSON (D-068,
 *      D-082); the guide and the catalogue are public (D-089), so their requests carry no credential beyond the
 *      browser's own cookie. Creating from a pattern is one portal request (D-085). The overview is also where the
 *      forms, the planner, the bank and the mappe page take the phase labels from (PED-001), so there is one call
 *      of `GET /api/studio` for every page.
 * Spec: PED-001, PED-002, PED-003, PED-010, PROD-001
 * Invariants:
 *   - Only `import type` from the contract, so zod stays out of the browser bundle.
 *   - The pattern ID and the locale are percent-encoded into the path.
 *   - The public reads send the portal credential without a CSRF token: a GET never needs one, and the answers are
 *     the same signed in or out. A page may pass its own credential to the overview (an LTI page sends its ltik and
 *     no cookie, ./apiRequest.ts).
 * Collaborators: ./apiRequest.ts, apps/server/src/learningDesign/http/studioContentRoutes.ts,
 *   apps/server/src/learningDesign/http/patternRoutes.ts, ../features/studio/.
 * Tests: apps/web/test/features/GuideView.test.tsx, apps/web/test/features/PatternDetailView.test.tsx,
 *   apps/web/test/api/studioApi.test.ts
 */
import type {
  ApiLocale,
  Guide,
  PatternActivityRequest,
  PatternActivityResponse,
  PatternDetail,
  StudioOverview,
} from '@hvl-interaktiv/api-contract';
import { apiRequest, type ApiAuth, type ApiResult } from './apiRequest';

const PUBLIC: ApiAuth = { kind: 'portal' };

/** The path of the studio overview. */
export const STUDIO_OVERVIEW_PATH = '/api/studio';

/**
 * The path of the guide in one language.
 * @param locale - The page's locale.
 * @returns e.g. `/api/studio/guide/nn`.
 */
export const studioGuidePath = (locale: ApiLocale): string =>
  `/api/studio/guide/${encodeURIComponent(locale)}`;

/**
 * The path of one pattern's detail.
 * @param patternId - The pattern.
 * @returns e.g. `/api/studio/patterns/fa-video`.
 */
export const patternDetailPath = (patternId: string): string =>
  `/api/studio/patterns/${encodeURIComponent(patternId)}`;

/**
 * The studio's phases, anchor, review status and pattern catalogue: the phase labels from content (PED-001) for
 * every page that names a phase.
 * @param auth - The page's credential; the browser's own cookie by default (the route is public, D-089).
 * @returns The overview.
 */
export const getStudioOverview = (auth: ApiAuth = PUBLIC): Promise<ApiResult<StudioOverview>> =>
  apiRequest<StudioOverview>(STUDIO_OVERVIEW_PATH, auth);

/**
 * The guide in one language; empty while no guide is written yet.
 * @param locale - The page's locale.
 * @returns The guide's nodes and references.
 */
export const getStudioGuide = (locale: ApiLocale): Promise<ApiResult<Guide>> =>
  apiRequest<Guide>(studioGuidePath(locale), PUBLIC);

/**
 * One pattern's page.
 * @param patternId - The pattern.
 * @returns The detail, or 404 for an unknown pattern.
 */
export const getPatternDetail = (patternId: string): Promise<ApiResult<PatternDetail>> =>
  apiRequest<PatternDetail>(patternDetailPath(patternId), PUBLIC);

/**
 * Creates a private draft from a pattern (D-085).
 * @param patternId - The pattern.
 * @param body - The language, and the phase, content type and course code when chosen.
 * @param auth - The portal credential with the CSRF token.
 * @returns The new activity's ID, or 400, 401, 403, 404 or 409 with the server's error.
 */
export const createFromPattern = (
  patternId: string,
  body: PatternActivityRequest,
  auth: ApiAuth,
): Promise<ApiResult<PatternActivityResponse>> =>
  apiRequest<PatternActivityResponse>(`/api/patterns/${encodeURIComponent(patternId)}/activities`, auth, {
    method: 'POST',
    body,
  });
