/**
 * editorView — the editor page for one person and one activity (or a new one), after the Edit check.
 *
 * Why: the portal (`/h5p/edit/:id`, `/h5p/new`) and Canvas (`/lti/edit`) show the same editor; only the token and
 *      the first scripts differ. Lumi's `H5PEditor.render` checks no permission, so this module checks Edit before
 *      anything is rendered or a file grant is issued (D-069).
 * Spec: H5P-006, H5P-007, PROD-002
 * Invariants:
 *   - An existing activity is rendered only when the permission system allows Edit for the account view;
 *     otherwise the result is `undefined` and nothing was issued.
 *   - The page carries the actor's own token only (ltik or CSRF), never anyone else's.
 * Collaborators: ../h5p/render/editorIntegration.ts, ../h5p/render/editorAssets.ts, ../h5p/render/editorPage.ts, ./routes/editorRoutes.ts,
 *   ../lti/play/ltiEditRoutes.ts.
 * Tests: apps/server/test/http/editorRoutes.int.test.ts, apps/server/test/h5p/editorPage.browser.int.test.ts
 */
import { ContentPermission, type IEditorModel } from '@lumieducation/h5p-server';
import { asAccountUser, type HvlH5pActor } from '../h5p/HvlH5pUser.js';
import { outerPageAssets } from '../h5p/render/editorAssets.js';
import { editorIntegration } from '../h5p/render/editorIntegration.js';
import { renderEditorPage } from '../h5p/render/editorPage.js';
import type { H5pRouteDeps } from './h5pRouteDeps.js';

/** What the editor view needs from the H5P runtime. */
export type EditorViewDeps = Pick<H5pRouteDeps, 'editor' | 'permissions' | 'uploadGrants'>;

/**
 * Renders the editor page when the actor may edit.
 * @param deps - Editor, permission system and upload grants.
 * @param actor - The authenticated person.
 * @param contentId - The activity; undefined for a new one.
 * @param firstScripts - Same-origin static scripts that run before H5P's.
 * @returns The HTML, or undefined when the actor may not edit the activity (or it does not exist).
 */
export async function editorView(
  deps: EditorViewDeps,
  actor: HvlH5pActor,
  contentId: string | undefined,
  firstScripts: readonly string[] = [],
): Promise<string | undefined> {
  const user = asAccountUser(actor);
  if (contentId !== undefined) {
    const mayEdit = await deps.permissions.checkForContent(user, ContentPermission.Edit, contentId);
    if (!mayEdit) return undefined;
  }
  const model = (await deps.editor.render(contentId as string, actor.locale, user)) as IEditorModel;
  const integration = editorIntegration(model.integration, {
    contentId,
    ownerId: user.id,
    contentUrl: (id) => {
      const url = model.urlGenerator.contentFilesUrl(id);
      // WHY: HvlUrlGenerator always returns one; Lumi's interface allows undefined for its own default.
      if (!url) throw new Error('the URL generator gave no content file URL');
      return url;
    },
    uploadGrants: deps.uploadGrants,
    baseUrl: deps.editor.config.baseUrl,
    now: new Date(),
  });
  const { config } = deps.editor;
  const assets = outerPageAssets(model, `${config.baseUrl}${config.editorLibraryUrl}/`);
  return renderEditorPage(
    {
      integration,
      scripts: assets.scripts,
      styles: assets.styles,
      contentId,
      token: actor.urlToken,
      firstScripts,
    },
    actor.locale,
  );
}
