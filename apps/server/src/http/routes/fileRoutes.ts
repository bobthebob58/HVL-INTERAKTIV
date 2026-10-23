/**
 * fileRoutes — streams the files of an activity and the editor's temporary uploads.
 *
 * Why: images, audio and video of an activity, and files an author just uploaded in the editor, are fetched by
 *      the player and the editor. Lumi checks the permission (View for content files, the uploader for
 *      temporary files) with the account view of the actor, because both are tied to the person's account,
 *      not to a learner pseudonym. Every answer carries the D-045 headers and correct byte ranges.
 * Spec: H5P-004, SEC-004, H5P-006
 * Invariants:
 *   - The actor's account view is the user; nothing in the request names another person.
 *   - Headers come from ../sendUserFile.ts (nosniff, sandbox CSP, attachment for non-media files).
 *   - A missing file is 404; any other failure before streaming is 500; after streaming starts, the socket ends.
 * Collaborators: ../sendUserFile.ts, ../h5pLocals.ts, ../routeParams.ts, Lumi's H5PAjaxEndpoint
 *   (getContentFile, getTemporaryFile).
 * Tests: apps/server/test/http/contentFiles.int.test.ts
 */
import { Router } from 'express';
import { asAccountUser } from '../../h5p/HvlH5pUser.js';
import { requireActor } from '../h5pLocals.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { pathParam, wildcardParam } from '../routeParams.js';
import { requestedRange, sendUserFile } from '../sendUserFile.js';

/**
 * Builds the file routes.
 * @param deps - The AJAX endpoint.
 * @returns A router for `GET /content/:contentId/*file` and `GET /temp-files/*file`.
 */
export function fileRoutes(deps: H5pRouteDeps): Router {
  const router = Router();

  router.get('/content/:contentId/*file', async (req, res) => {
    const user = asAccountUser(requireActor(res));
    const filename = wildcardParam(req, 'file');
    const file = await deps.ajax.getContentFile(
      pathParam(req, 'contentId'),
      filename,
      user,
      requestedRange(req),
    );
    await sendUserFile(res, file, filename);
  });

  router.get('/temp-files/*file', async (req, res) => {
    const user = asAccountUser(requireActor(res));
    const filename = wildcardParam(req, 'file');
    // UPSTREAM: the d.ts omits `undefined` (whole file), which the code handles; see https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/H5PAjaxEndpoint.ts
    const range = requestedRange(req) as (size: number) => { start: number; end: number };
    const file = await deps.ajax.getTemporaryFile(filename, user, range);
    await sendUserFile(res, file, filename);
  });
  return router;
}
