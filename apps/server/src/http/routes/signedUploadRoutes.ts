/**
 * signedUploadRoutes — serves an author's fresh editor uploads to whoever holds a valid upload grant.
 *
 * Why: right after an upload the editor shows the file from `H5PIntegration.editor.filesPath + "/" + path`, from
 *      `<img>` and `<video>` tags that carry no ltik and, in a Canvas iframe, no cookie. The editor page puts a
 *      grant for the uploading account into `filesPath` (../../h5p/render/editorIntegration.ts, D-069), and this
 *      public route serves that account's uploads with the headers of every user file (`SEC-004`, D-045).
 * Spec: H5P-007, SEC-004
 * Invariants:
 *   - The grant (purpose `temporary-file-url`) is verified for the account ID in the path before storage is read;
 *     any failure is 403 `hvl:file-grant-invalid`, one answer for every reason.
 *   - Files come from the temporary storage under that account's own key prefix only; a missing file is 404.
 *   - Headers and ranges as ../sendUserFile.ts, plus `Cache-Control: private, max-age=<seconds the grant has left>`.
 *   - No session, ltik or cookie is read; storage receives a user that only names the account (no roles), which
 *     the permission system never accepts.
 * Collaborators: ../../h5p/contentFileGrants.ts, ../../h5p/render/editorIntegration.ts, ../sendUserFile.ts,
 *   ../createH5pRouter.ts (mounts it before authentication).
 * Tests: apps/server/test/http/signedUploads.int.test.ts
 */
import type { IUser } from '@lumieducation/h5p-server';
import { Router } from 'express';
import { SIGNED_UPLOADS_PATH } from '../../h5p/render/editorIntegration.js';
import { authError } from '../authErrors.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { pathParam, wildcardParam } from '../routeParams.js';
import { requestedRange, sendUserFile } from '../sendUserFile.js';

/** What the signed-upload route needs from the H5P runtime. */
export type SignedUploadDeps = Pick<H5pRouteDeps, 'editor' | 'uploadGrants'>;

/**
 * Builds the signed-upload route.
 * @param deps - The editor (its temporary storage) and the upload grant verifier.
 * @returns A router for `GET` and `HEAD /uploads/:grant/:owner/*file`.
 */
export function signedUploadRoutes(deps: SignedUploadDeps): Router {
  const router = Router();
  router.get(`${SIGNED_UPLOADS_PATH}/:grant/:owner/*file`, async (req, res) => {
    const owner = pathParam(req, 'owner');
    const now = new Date();
    const grant = deps.uploadGrants.verifyGrant(pathParam(req, 'grant'), owner, now);
    if (!grant.valid) throw authError('hvl:file-grant-invalid');
    const filename = wildcardParam(req, 'file');
    // SECURITY: not issued by ../../h5p/HvlH5pUser.ts; the storage uses only `id` for its key prefix.
    const holder: IUser = Object.freeze({ id: owner, name: '', email: '', type: 'local' as const });
    const storage = deps.editor.temporaryStorage;
    const stats = await storage.getFileStats(filename, holder);
    const range = requestedRange(req)(stats.size);
    const stream = await storage.getFileStream(filename, holder, range?.start, range?.end);
    const secondsLeft = Math.max(0, grant.expiresAt - Math.floor(now.getTime() / 1000));
    res.set('Cache-Control', `private, max-age=${secondsLeft}`);
    await sendUserFile(res, { stream, stats, range }, filename);
  });
  return router;
}
