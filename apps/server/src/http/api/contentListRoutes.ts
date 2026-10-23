/**
 * contentListRoutes — `GET /api/content` (the person's own and co-authored activities) and
 * `GET /api/content/:contentId` (one activity and what the person may do with it).
 *
 * Why: the web app's start page lists an author's activities with their status, and the activity page decides from
 *      `mayEdit`/`mayPublish` whether to offer the editor and the publish flow (PROD-003). The rights come from the
 *      H5P-006 matrix, so the API and the H5P routes never disagree.
 * Spec: PROD-003, PROD-004, PROD-006, H5P-006, DOC-012
 * Auth: either — a portal session or an ltik as `Authorization: Bearer` (both GET, so no CSRF token).
 * Errors: 401 `hvl:unauthenticated`, `hvl:session-expired`, `hvl:ltik-invalid`; the detail also 404
 *   `hvl:activity-unavailable` (unknown, or not viewable: the same answer, D-066).
 * Invariants:
 *   - The list holds only activities the account owns or co-authors; learners get an empty list.
 *   - The detail is answered only when the person may view the activity.
 * Collaborators: ./apiRouter.ts, ../../content/contentSummaries.ts, ../../content/contentAccess.ts.
 * Tests: apps/server/test/http/api/contentListRoutes.int.test.ts
 */
import type { ContentDetail, ContentList } from '@hvl-interaktiv/api-contract';
import { Router } from 'express';
import { canAuthor } from '../../auth/Principal.js';
import { requirePrincipal } from '../../auth/principalLocals.js';
import { viewableContent } from '../../content/contentAccess.js';
import { authoredContent, summaryFields, summaryRow } from '../../content/contentSummaries.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import type { Database } from '../../infra/prismaClient.js';
import { authError } from '../authErrors.js';
import { pathParam } from '../routeParams.js';

/**
 * Builds the content list and detail routes.
 * @param deps - The database and the activity facts.
 * @returns A router to mount at `/api`.
 */
export function contentListRoutes(deps: { db: Database; access: ContentAccessRepository }): Router {
  const router = Router();

  router.get('/content', async (_req, res) => {
    const principal = requirePrincipal(res);
    // WHY: learners author nothing; an empty list needs no query and reveals nothing.
    const items = canAuthor(principal) ? await authoredContent(deps.db, principal.userId) : [];
    res.json({ items } satisfies ContentList);
  });

  router.get('/content/:contentId', async (req, res) => {
    const principal = requirePrincipal(res);
    const access = await viewableContent(deps.access, principal, pathParam(req, 'contentId'));
    const row = await summaryRow(deps.db, access.facts.contentId);
    if (!row) throw authError('hvl:activity-unavailable');
    const detail: ContentDetail = {
      ...summaryFields(row),
      role: access.role,
      mayEdit: access.mayEdit,
      mayPublish: access.mayEdit,
    };
    res.json(detail);
  });
  return router;
}
