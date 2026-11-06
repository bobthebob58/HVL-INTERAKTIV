/**
 * signedFileRoutes — serves an activity's files to whoever holds a valid grant: the player's file URLs on the files
 * origin, and the editor's on the app origin.
 *
 * Why: H5P loads images, audio and video from `contentUrl + "/" + path`, from `<img>` and `<video>` tags that can
 *      carry neither the ltik (a header) nor the portal session in a Canvas iframe without third-party cookies.
 *      The player render, after its View check, signs `contentUrl` with a grant (D-058, ../../h5p/HvlUrlGenerator.ts),
 *      and so does the editor render after its Edit check (D-069, ../../h5p/render/editorIntegration.ts). This
 *      public route serves the files when the grant is valid, with the same headers as every user file (`SEC-004`,
 *      D-045). Each mount accepts one kind of grant: the player's on the files origin (../filesOriginRouter.ts), the
 *      editor's on the app origin (../createH5pRouter.ts), so a grant never opens a file on the other origin (D-110
 *      amendment of 2026-11-05).
 * Spec: H5P-007, SEC-004, H5P-004
 * Invariants:
 *   - The grant is verified, with the mount's own purpose key, before storage is read; any failure is 403
 *     `hvl:file-grant-invalid`, one answer for every reason (malformed, removed key, expired, too far ahead, other
 *     activity, other purpose, wrong signature).
 *   - Files come from the content storage only, by the activity's registered file name (no traversal, no
 *     fallback to the editor's temporary files); a missing file is 404, and so is a name no stored file can have
 *     (`assertSafeObjectName`: a control character, a backslash, a dot segment), which never reaches the database.
 *   - Headers and byte ranges are those of the authenticated file route (../sendUserFile.ts: nosniff, sandbox
 *     CSP, attachment for non-media), plus `Cache-Control: private, max-age=<seconds the grant has left>`.
 *   - No identity is read or set here: no actor, session, ltik or cookie. Storage receives an anonymous user
 *     that no permission check accepts, so a check added there later fails closed.
 * Collaborators: ../../h5p/contentFileGrants.ts, ../sendUserFile.ts, ../routeParams.ts, ../authErrors.ts,
 *   ../HttpError.ts, ../../h5p/storage/s3Objects.ts (`assertSafeObjectName`), ../filesOriginRouter.ts and ../createH5pRouter.ts (mount it before any authentication), Lumi's ContentManager
 *   (`contentStorage`).
 * Tests: apps/server/test/http/signedFiles.int.test.ts, apps/server/test/http/filesOrigin.int.test.ts,
 *   apps/server/test/http/editorFiles.int.test.ts
 */
import type { IUser } from '@lumieducation/h5p-server';
import { Router } from 'express';
import type { ContentFileGrants } from '../../h5p/contentFileGrants.js';
import { assertSafeObjectName } from '../../h5p/storage/s3Objects.js';
import { authError } from '../authErrors.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { HttpError } from '../HttpError.js';
import { pathParam, wildcardParam } from '../routeParams.js';
import { requestedRange, sendUserFile } from '../sendUserFile.js';

/** What a signed-file route needs: the content storage and the one kind of grant it accepts. */
export interface SignedFileDeps {
  /** The editor, for its content storage. */
  readonly editor: H5pRouteDeps['editor'];
  /** The grants this mount accepts: the player's (`content-file-url`) or the editor's (`editor-file-url`). */
  readonly grants: ContentFileGrants;
}

// SECURITY: not issued by ../../h5p/HvlH5pUser.ts, so HvlPermissionSystem denies it everything (D-036).
const GRANT_HOLDER: IUser = Object.freeze({ id: '', name: '', email: '', type: 'local' as const });

/** Whether a stored file could have this name: the storage refuses every other name when it writes one. */
const isStorableName = (name: string): boolean => {
  try {
    assertSafeObjectName(name);
    return true;
  } catch {
    return false;
  }
};

/**
 * Builds a signed-file route.
 * @param deps - The editor (its content storage) and the grant verifier of this mount.
 * @param path - Where the route answers, e.g. `/files` (the player's) or `/editor-files` (the editor's).
 * @returns A router for `GET` and `HEAD <path>/:grant/:contentId/*file`.
 */
export function signedFileRoutes(deps: SignedFileDeps, path: string): Router {
  const router = Router();
  // WHY: Express answers HEAD with the GET handler and sends no body.
  router.get(`${path}/:grant/:contentId/*file`, async (req, res) => {
    const contentId = pathParam(req, 'contentId');
    const now = new Date();
    const grant = deps.grants.verifyGrant(pathParam(req, 'grant'), contentId, now);
    if (!grant.valid) throw authError('hvl:file-grant-invalid');
    const filename = wildcardParam(req, 'file');
    // SECURITY: a grant holder's NUL byte would otherwise reach PostgreSQL and end as a 500 with an error line.
    if (!isStorableName(filename)) throw new HttpError(404, 'error.notFound');
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
