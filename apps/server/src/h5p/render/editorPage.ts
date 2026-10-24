/**
 * editorPage — our HTML template for the H5P editor (authoring one activity), with no inline script.
 *
 * Why: Lumi's editor template writes the integration JSON into an inline script unescaped (D-040), and the page
 *      must work under the strict H5P policy (D-070). The integration object travels as an inert JSON block, a
 *      second block carries what our boot script needs (activity ID, token, messages), and the boot script
 *      (./client/editorPage.js) starts H5P's editor, loads the parameters and saves through the content API.
 * Spec: H5P-002, H5P-007, SEC-008, UD-010, DATA-011, UD-002
 * Invariants:
 *   - Every value is escaped; both JSON blocks go through `scriptJson`.
 *   - The page has a `lang`, a title, one save button and a polite status region for save results (UD-006).
 *   - First scripts are only same-origin static files (`/static/…js`), e.g. the LTI landing script.
 *   - The server pages' stylesheet comes after H5P's styles, so the save button and the status use the token
 *     typography, colours and target size like every server page (UD-002, UD-005, D-067); the editor keeps its
 *     full width.
 * Collaborators: ./editorIntegration.ts, ./playerPage.ts (shared boot script), ./scriptJson.ts,
 *   ../../http/routes/editorRoutes.ts, ../../lti/play/ltiEditRoutes.ts, ../../http/pages/pageAssetRoutes.ts
 *   (the stylesheet).
 * Tests: apps/server/test/h5p/render/editorPage.test.ts, apps/server/test/http/pages/serverPages.browser.test.ts
 */
import type { IIntegration } from '@lumieducation/h5p-server';
import { SERVER_PAGES_STYLESHEET } from '../../http/pages/pageAssetRoutes.js';
import { t, type Locale } from '../../i18n/translate.js';
import type { UrlToken } from '../HvlH5pUser.js';
import { H5P_INTEGRATION_SCRIPT } from './playerPage.js';
import { escapeHtml, scriptJson } from './scriptJson.js';

/** Where the H5P router serves ./client/editorPage.js. */
export const EDITOR_BOOT_SCRIPT = '/h5p/boot/editorPage.js';
/** Where the H5P router serves ./client/editorFields.js, which the boot script needs ("Gå til feltet"). */
export const EDITOR_FIELDS_SCRIPT = '/h5p/boot/editorFields.js';

/** What the editor page is built from. */
export interface EditorPageInput {
  /** The integration from ./editorIntegration.ts. */
  readonly integration: IIntegration;
  readonly scripts: readonly string[];
  readonly styles: readonly string[];
  /** The activity being edited; undefined for a new one. */
  readonly contentId: string | undefined;
  /** The token the page's own requests carry: the ltik as Bearer, or the CSRF token as a header. */
  readonly token: UrlToken | undefined;
  /** Same-origin static scripts that run before H5P's. */
  readonly firstScripts?: readonly string[];
}

/**
 * Renders the editor page.
 * @param input - Integration, assets, activity, token and first scripts.
 * @param language - The page language.
 * @returns A complete HTML document.
 * @throws Error when a first script is not a same-origin static file (a programming error).
 */
export function renderEditorPage(input: EditorPageInput, language: Locale): string {
  const first = (input.firstScripts ?? []).map((src) => {
    // SECURITY: only our own static files, never a URL from a request.
    if (!/^\/static\/(?!.*\.\.)[\w/.-]+\.js$/.test(src)) throw new Error(`invalid script path: ${src}`);
    return `<script src="${escapeHtml(src)}"></script>`;
  });
  const config = {
    contentId: input.contentId ?? null,
    token: input.token ?? null,
    messages: {
      saving: t('page.editor.saving', {}, language),
      saved: t('page.editor.saved', {}, language),
      failed: t('page.editor.saveFailed', {}, language),
      // WHY: `{{count}}` stays literal (no param given); editorPage.js fills in the number of open errors.
      blockedErrors: t('page.editor.blockedErrors', {}, language),
      editorFrameTitle: t('page.editor.frameTitle', {}, language),
    },
  };
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(language)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(t('page.editor.title', {}, language))}</title>`,
    ...first,
    `<script type="application/json" id="h5p-integration">${scriptJson(input.integration)}</script>`,
    `<script type="application/json" id="hvl-editor-config">${scriptJson(config)}</script>`,
    `<script src="${H5P_INTEGRATION_SCRIPT}"></script>`,
    ...input.styles.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`),
    `<link rel="stylesheet" href="${SERVER_PAGES_STYLESHEET}">`,
    ...input.scripts.map((src) => `<script src="${escapeHtml(src)}"></script>`),
    '</head>',
    '<body>',
    '<main class="hvl-editor">',
    '<div class="h5p-create"><div class="h5p-editor"></div></div>',
    `<p><button type="button" id="hvl-editor-save" disabled>${escapeHtml(t('page.editor.save', {}, language))}</button></p>`,
    '<p id="hvl-editor-status" role="status" aria-live="polite"></p>',
    '</main>',
    `<script src="${EDITOR_FIELDS_SCRIPT}"></script>`,
    `<script src="${EDITOR_BOOT_SCRIPT}"></script>`,
    '</body>',
    '</html>',
  ].join('\n');
}
