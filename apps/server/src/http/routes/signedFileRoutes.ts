/**
 * signedFileRoutes — serves an activity's files to whoever holds a valid grant: the file URLs of the player.
 *
 * Why: H5P loads images, audio and video from `contentUrl + "/" + path`, from `<img>` and `<video>` tags that can
 *      carry neither the ltik (a header) nor the portal session in a Canvas iframe without third-party cookies.
 *      The player render, after its View check, signs `contentUrl` with a grant (D-058, ../../h5p/HvlUrlGenerator.ts),
 *      and this public route serves the files when that grant is valid, with the same headers as every user file
 *      (`SEC-004`, D-045).
 * Spec: H5P-007, SEC-004, H5P-004
 * Invariants:
 *   - The grant is verified before storage is read; any failure is 403 `hvl:file-grant-invalid`, one answer for
 *     every reason (malformed, removed key, expired, too far ahead, other activity, wrong signature).
 *   - Files come from the content storage only, by the activity's registered file name (no traversal, no
 *     fallback to the editor's temporary files); a missing file is 404.
 *   - Headers and byte ranges are those of the authenticated file route (../sendUserFile.ts: nosniff, sandbox
 *     CSP, attachment for non-media), plus `Cache-Control: private, max-age=<seconds the grant has left>`.
 *   - No identity is read or set here: no actor, session, ltik or cookie. Storage receives an anonymous user
 *     that no permission check accepts, so a check added there later fails closed.
 * Collaborators: ../../h5p/contentFileGrants.ts, ../sendUserFile.ts, ../routeParams.ts, ../authErrors.ts,
 *   ../createH5pRouter.ts (mounts it before authentication), Lumi's ContentManager (`contentStorage`).
 * Tests: apps/server/test/http/signedFiles.int.test.ts
 */
import type { IUser } from '@lumieducation/h5p-server';
import { Router } from 'express';
import { SIGNED_FILES_PATH } from '../../h5p/HvlUrlGenerator.js';
import { authError } from '../authErrors.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { pathParam, wildcardParam } from '../routeParams.js';
import { requestedRange, sendUserFile } from '../sendUserFile.js';

/** What the signed-file route needs from the H5P runtime. */
export type SignedFileDeps = Pick<H5pRouteDeps, 'editor' | 'fileGrants'>;

// SECURITY: not issued by ../../h5p/HvlH5pUser.ts, so HvlPermissionSystem denies it everything (D-036).
const GRANT_HOLDER: IUser = Object.freeze({ id: '', name: '', email: '', type: 'local' as const });

/**
 * Builds the signed-file route.
 * @param deps - The editor (its content storage) and the grant verifier.
 * @returns A router for `GET` and `HEAD /files/:grant/:contentId/*file`.
 */
export function signedFileRoutes(deps: SignedFileDeps): Router {
  const router = Router();
  // WHY: Express answers HEAD with the GET handler and sends no body.
  router.get(`${SIGNED_FILES_PATH}/:grant/:contentId/*file`, async (req, res) => {
    const contentId = pathParam(req, 'contentId');
    const now = new Date();
    const grant = deps.fileGrants.verifyGrant(pathParam(req, 'grant'), contentId, now);
    if (!grant.valid) throw authError('hvl:file-grant-invalid');
    const filename = wildcardParam(req, 'file');
    const storage = deps.editor.contentManager.contentStorage;
    const stats = await storage.getFileStats(contentId, filename, GRANT_HOLDER);
    const range = requestedRange(req)(stats.size);
    const stream = await storage.getFileStream(contentId, filename, GRANT_HOLDER, range?.start, range?.end);
    // WHY: the URL stops working when the grant expires, so a cached copy is never kept longer than that.
    // `private` keeps files of non-public activities out of shared caches.
    const secondsLeft = Math.max(0, grant.expiresAt - Math.floor(now.getTime() / 1000));
    res.set('Cache-Control', `private, max-age=${secondsLeft}`);
    await sendUserFile(res, { stream, stats, range }, filename);
  });
  return router;
}
