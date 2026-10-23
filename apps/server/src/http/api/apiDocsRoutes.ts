/**
 * apiDocsRoutes — `GET /api/docs`: the OpenAPI 3.1 document of the `/api` routes, in development and test only.
 *
 * Why: DOC-012 serves the document generated from the zod schemas at `/api/docs` in development (D-077), so the web
 *      app's authors and reviewers read the same contract the server validates with.
 * Spec: DOC-012
 * Auth: none — anyone may read it; it is mounted only when NODE_ENV is not `production`.
 * Errors: none of its own (404 `error.notFound` in production, where the route does not exist).
 * Invariants:
 *   - The document is built once, from `@hvl-interaktiv/api-contract`, never from request data.
 * Collaborators: ./apiRouter.ts, @hvl-interaktiv/api-contract (`buildOpenApiDocument`).
 * Tests: apps/server/test/http/api/apiDocs.int.test.ts
 */
import { buildOpenApiDocument } from '@hvl-interaktiv/api-contract';
import { Router } from 'express';

/**
 * Builds the docs route.
 * @returns A router to mount at `/api`.
 */
export function apiDocsRoutes(): Router {
  const document = buildOpenApiDocument();
  const router = Router();
  router.get('/docs', (_req, res) => {
    res.json(document);
  });
  return router;
}
