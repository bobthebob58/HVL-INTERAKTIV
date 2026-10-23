/**
 * editorIntegration — turns Lumi's editor integration into the one our editor page sends: no user identity, and
 * file URLs that carry signed grants instead of needing a cookie.
 *
 * Why: in a Canvas iframe without third-party cookies the editor's `<img>` and `<video>` requests carry no
 *      credential, so content files and fresh uploads need grant-bearing URLs (D-058, D-069). H5P builds them from
 *      `H5PIntegration.contents['cid-<id>'].contentUrl` (saved files) and `H5PIntegration.editor.filesPath`
 *      (uploads ending in `#tmp`). Lumi's integration also names the user, which no page needs (DATA-002).
 * Spec: H5P-007, SEC-004, DATA-002
 * Invariants:
 *   - Call only after the Edit check on `contentId` (a new activity has none); the grants are issued here.
 *   - `user` is always `{ name: '', mail: '', id: '' }`.
 *   - The upload grant is bound to the account that owns the uploads (the account view's `id`).
 * Collaborators: ./editorPage.ts, ../contentFileGrants.ts, ../HvlUrlGenerator.ts, ../../http/routes/editorRoutes.ts,
 *   ../../lti/play/ltiEditRoutes.ts, ../../http/routes/signedUploadRoutes.ts (serves `filesPath`).
 * Tests: apps/server/test/h5p/render/editorIntegration.test.ts
 */
import type { IIntegration } from '@lumieducation/h5p-server';
import type { ContentFileGrants } from '../contentFileGrants.js';
import { ANONYMOUS_H5P_USER } from './playerPage.js';

/** The path under the H5P base URL where upload grants are served (../../http/routes/signedUploadRoutes.ts). */
export const SIGNED_UPLOADS_PATH = '/uploads';

/** What the grants are issued for. */
export interface EditorGrantInputs {
  /** The activity being edited; undefined for a new one. */
  readonly contentId: string | undefined;
  /** The account that owns the uploads (`asAccountUser(actor).id`). */
  readonly ownerId: string;
  /** The base of the activity's file URLs, with a fresh content grant (`urlGenerator.contentFilesUrl`). */
  readonly contentUrl: (contentId: string) => string;
  /** Signs upload URLs (purpose `temporary-file-url`). */
  readonly uploadGrants: ContentFileGrants;
  /** The H5P base URL, e.g. `/h5p`. */
  readonly baseUrl: string;
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
  const filesPath = `${inputs.baseUrl}${SIGNED_UPLOADS_PATH}/${grant}/${encodeURIComponent(inputs.ownerId)}`;
  const contents =
    inputs.contentId === undefined
      ? {}
      : { [`cid-${inputs.contentId}`]: { contentUrl: inputs.contentUrl(inputs.contentId) } };
  return {
    ...integration,
    user: { ...ANONYMOUS_H5P_USER },
    editor: { ...integration.editor, filesPath },
    contents: contents as unknown as IIntegration['contents'],
  } as IIntegration;
}
