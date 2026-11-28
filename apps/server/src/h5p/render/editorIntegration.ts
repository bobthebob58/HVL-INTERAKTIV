/**
 * editorIntegration — turns Lumi's editor integration into the one our editor page sends: no user identity, and
 * file URLs on the files origin that carry signed grants instead of needing a cookie.
 *
 * Why: in a Canvas iframe without third-party cookies the editor's `<img>` and `<video>` requests carry no
 *      credential, so content files and fresh uploads need grant-bearing URLs (D-058, D-069). H5P builds them from
 *      `H5PIntegration.contents['cid-<id>'].contentUrl` (saved files) and `H5PIntegration.editor.filesPath`
 *      (uploads ending in `#tmp`). Both are files an author uploaded, so both come from the files origin, as the
 *      player's do (`SEC-004`, D-153). Lumi's integration also names the user, which no page needs (DATA-002).
 * Spec: H5P-007, SEC-004, DATA-002
 * Invariants:
 *   - Call only after the Edit check on `contentId` (a new activity has none); the grants are issued here.
 *   - `user` is always `{ name: '', mail: '', id: '' }`.
 *   - Saved files use an editor grant (purpose `editor-file-url`) at `<files origin>/h5p/editor-files/…`, uploads an
 *     upload grant at `<files origin>/h5p/uploads/…`; the player's grants are never used here, and no URL of an
 *     uploaded file points at the app origin.
 *   - The upload grant is bound to the account that owns the uploads (the account view's `id`).
 *   - `crossorigin` is `anonymous`, as on the player page: H5P's picture tool draws a picture into a canvas and
 *     exports it, which a browser allows for another origin's picture only when it was loaded in CORS mode (D-153).
 * Collaborators: ./editorPage.ts, ../contentFileGrants.ts, ../../http/editorView.ts, ../../http/routes/editorRoutes.ts,
 *   ../../lti/play/ltiEditRoutes.ts, ../../http/filesOriginRouter.ts (serves both), ../../config/filesOrigin.ts,
 *   ./playerPage.ts (`USER_FILE_CROSSORIGIN`).
 * Tests: apps/server/test/h5p/render/editorIntegration.test.ts
 */
import type { IIntegration } from '@lumieducation/h5p-server';
import type { ContentFileGrants } from '../contentFileGrants.js';
import { ANONYMOUS_H5P_USER, USER_FILE_CROSSORIGIN } from './playerPage.js';

/** The path under the H5P base URL where upload grants are served (../../http/routes/signedUploadRoutes.ts). */
export const SIGNED_UPLOADS_PATH = '/uploads';

/** The path under the H5P base URL where the editor's grants open saved files (../../http/filesOriginRouter.ts). */
export const EDITOR_FILES_PATH = '/editor-files';

/** What the grants are issued for. */
export interface EditorGrantInputs {
  /** The activity being edited; undefined for a new one. */
  readonly contentId: string | undefined;
  /** The account that owns the uploads (`asAccountUser(actor).id`). */
  readonly ownerId: string;
  /** Signs the saved files' URLs (purpose `editor-file-url`). */
  readonly contentGrants: ContentFileGrants;
  /** Signs upload URLs (purpose `temporary-file-url`). */
  readonly uploadGrants: ContentFileGrants;
  /** The H5P base URL, e.g. `/h5p`. */
  readonly baseUrl: string;
  /** The files origin (../../config/filesOrigin.ts); `''` in a test bed that serves the files on its one server. */
  readonly filesOrigin: string;
  readonly now: Date;
}

/**
 * The integration object of our editor page.
 * @param integration - Lumi's integration from `H5PEditor.render`.
 * @param inputs - The activity, the owner and the grant issuers.
 * @returns A new object; Lumi's is not changed.
 */
export function editorIntegration(integration: IIntegration, inputs: EditorGrantInputs): IIntegration {
  const grant = inputs.uploadGrants.issueGrant(inputs.ownerId, inputs.now);
  // SECURITY: every file an author uploaded comes from the files origin, never from the app's own (SEC-004).
  const files = `${inputs.filesOrigin}${inputs.baseUrl}`;
  const filesPath = `${files}${SIGNED_UPLOADS_PATH}/${grant}/${encodeURIComponent(inputs.ownerId)}`;
  const id = inputs.contentId;
  const contentUrl = (saved: string) => {
    const fileGrant = inputs.contentGrants.issueGrant(saved, inputs.now);
    return `${files}${EDITOR_FILES_PATH}/${fileGrant}/${encodeURIComponent(saved)}`;
  };
  const contents = id === undefined ? {} : { [`cid-${id}`]: { contentUrl: contentUrl(id) } };
  return {
    ...integration,
    user: { ...ANONYMOUS_H5P_USER },
    // WHY: without it the picture tool's canvas is tainted by a picture of the files origin and cannot be saved.
    crossorigin: USER_FILE_CROSSORIGIN,
    editor: { ...integration.editor, filesPath },
    contents: contents as unknown as IIntegration['contents'],
  } as IIntegration;
}
