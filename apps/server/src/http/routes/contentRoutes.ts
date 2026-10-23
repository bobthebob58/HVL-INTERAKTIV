/**
 * contentRoutes — loads, saves, deletes and exports an activity.
 *
 * Why: the editor page (S4) loads an activity's parameters, saves what the author built and can delete it; the
 *      export gives the author a `.h5p` package. All rules (the ten types, the sub-content policy, sanitising,
 *      the permission matrix, learner-state invalidation) live in HvlH5PEditor and the permission system; the
 *      routes only check the shape of the request and use the actor's account view.
 * Spec: H5P-002, H5P-006, SEC-003, SEC-008, PROD-002
 * Invariants:
 *   - Only `author` and `admin` reach save, delete and parameters; export is decided by the permission system.
 *   - A save body is `{ library: string, params: { params: object, metadata: object } }`, else 400.
 *   - The export is always a download (`attachment`, `nosniff`) named after the content ID, never a title.
 * Collaborators: ../../h5p/HvlH5PEditor.ts, ../requestBodies.ts, Lumi's H5PAjaxEndpoint.
 * Tests: apps/server/test/http/contentSave.int.test.ts
 */
import type { ContentParameters, IContentMetadata } from '@lumieducation/h5p-server';
import { Router } from 'express';
import { asAccountUser } from '../../h5p/HvlH5pUser.js';
import { HttpError } from '../HttpError.js';
import { requireActor, requireRole } from '../h5pLocals.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { jsonBody } from '../requestBodies.js';
import { pathParam } from '../routeParams.js';

interface SaveRequest {
  readonly library: string;
  readonly params: ContentParameters;
  readonly metadata: IContentMetadata;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const saveRequest = (body: unknown): SaveRequest => {
  if (!isObject(body) || typeof body.library !== 'string' || !isObject(body.params)) {
    throw new HttpError(400, 'error.badRequest');
  }
  const { params, metadata } = body.params;
  if (!isObject(params) || !isObject(metadata)) throw new HttpError(400, 'error.badRequest');
  return { library: body.library, params, metadata: metadata as unknown as IContentMetadata };
};

/**
 * Builds the content routes.
 * @param deps - Editor and AJAX endpoint.
 * @returns A router for `/params/:contentId`, `/content`, `/content/:contentId` and `/download/:contentId`.
 */
export function contentRoutes(deps: H5pRouteDeps): Router {
  const router = Router();
  const authorsOnly = requireRole('author', 'admin');

  router.get('/params/:contentId', authorsOnly, async (req, res) => {
    const user = asAccountUser(requireActor(res));
    res.json(await deps.ajax.getContentParameters(pathParam(req, 'contentId'), user));
  });

  router.post('/content', authorsOnly, ...jsonBody, async (req, res) => {
    const user = asAccountUser(requireActor(res));
    const { library, params, metadata } = saveRequest(req.body);
    const contentId = await deps.editor.saveOrUpdateContent(undefined, params, metadata, library, user);
    res.status(201).json({ contentId });
  });

  router.put('/content/:contentId', authorsOnly, ...jsonBody, async (req, res) => {
    const user = asAccountUser(requireActor(res));
    const { library, params, metadata } = saveRequest(req.body);
    const contentId = await deps.editor.saveOrUpdateContent(
      pathParam(req, 'contentId'),
      params,
      metadata,
      library,
      user,
    );
    res.json({ contentId });
  });

  router.delete('/content/:contentId', authorsOnly, async (req, res) => {
    await deps.editor.deleteContent(pathParam(req, 'contentId'), asAccountUser(requireActor(res)));
    res.status(204).end();
  });

  router.get('/download/:contentId', async (req, res) => {
    const user = asAccountUser(requireActor(res));
    const contentId = pathParam(req, 'contentId');
    // WHY: the ID is a UUID (checked by the permission system); a title could carry header-breaking characters.
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(contentId)}.h5p"`,
      'X-Content-Type-Options': 'nosniff',
    });
    await deps.ajax.getDownload(contentId, user, res);
    res.end();
  });
  return router;
}
