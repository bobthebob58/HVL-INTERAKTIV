/**
 * publishRoutes — `GET /api/content/:contentId/findings`, `POST …/publish` and `POST …/unpublish`: the
 * check-and-publish gate of PROD-003.
 *
 * Why: an author sees the validator's findings for the stored activity, publishes with a reason for each error they
 *      publish despite (UD-022), and can return the activity to draft. D-074 puts the whole decision on the server:
 *      the stored activity is validated again and the client's view of the findings is never trusted.
 * Spec: PROD-003, UD-022, DATA-007, DOC-012
 * Auth: either — a portal session (the CSRF token on POST) or an ltik as `Authorization: Bearer`; only those who
 *   may edit the activity (H5P-006 Edit).
 * Errors: 401 `hvl:unauthenticated`, `hvl:session-expired`, `hvl:ltik-invalid`, `hvl:csrf-invalid`;
 *   404 `hvl:activity-unavailable` (unknown or not viewable); 403 `hvl:edit-not-allowed` (viewable, not editable);
 *   400 `error.badRequest` (body) and `hvl:acknowledgement-invalid` (a reason for no current error);
 *   409 `hvl:publish-blocked` (with `findings`) and `hvl:content-changed` (`updatedAt` differs or a racing save).
 * Invariants:
 *   - Access is checked before the body, so someone who may not edit learns nothing from a 400; bodies are checked
 *     with the contract's schemas.
 *   - Messages are in the principal's language.
 * Collaborators: ./apiRouter.ts, ./apiBodies.ts, ../../content/ContentPublisher.ts, ../../content/contentAccess.ts.
 * Tests: apps/server/test/http/api/publishRoutes.int.test.ts, apps/server/test/http/api/publishGuards.int.test.ts
 */
import { publishRequestSchema, unpublishRequestSchema } from '@hvl-interaktiv/api-contract';
import { Router, type Request, type Response } from 'express';
import { requirePrincipal } from '../../auth/principalLocals.js';
import { editableContent } from '../../content/contentAccess.js';
import type { ContentPublisher } from '../../content/ContentPublisher.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { pathParam } from '../routeParams.js';
import { apiJson, parseBody } from './apiBodies.js';

/**
 * Builds the findings, publish and unpublish routes.
 * @param deps - The activity facts and the publisher.
 * @returns A router to mount at `/api`.
 */
export function publishRoutes(deps: {
  access: ContentAccessRepository;
  publisher: ContentPublisher;
}): Router {
  const router = Router();
  const editor = async (req: Request, res: Response) => {
    const principal = requirePrincipal(res);
    const { facts } = await editableContent(deps.access, principal, pathParam(req, 'contentId'));
    return { contentId: facts.contentId, by: principal };
  };

  router.get('/content/:contentId/findings', async (req, res) => {
    const { contentId, by } = await editor(req, res);
    res.json(await deps.publisher.findings(contentId, by.locale));
  });

  // WHY: the contract allows 500 acknowledgements with a 1000-character path and a 500-character reason each.
  router.post('/content/:contentId/publish', apiJson('2mb'), async (req, res) => {
    const { contentId, by } = await editor(req, res);
    const request = parseBody(publishRequestSchema, req.body);
    res.json(await deps.publisher.publish(contentId, by, request));
  });

  router.post('/content/:contentId/unpublish', apiJson('1kb'), async (req, res) => {
    const { contentId, by } = await editor(req, res);
    const request = parseBody(unpublishRequestSchema, req.body);
    res.json(await deps.publisher.unpublish(contentId, by, request));
  });
  return router;
}
