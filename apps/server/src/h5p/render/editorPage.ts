/**
 * editorPage — our HTML template for the H5P editor (authoring one activity), with no inline script.
 *
 * Why: Lumi's editor template writes the integration JSON into an inline script unescaped (D-040), and the page
 *      must work under the strict H5P policy (D-070). The integration object travels as an inert JSON block, a
 *      second block carries what our boot script needs (activity ID, token, messages, the save choice's texts), and
 *      the boot script (./client/editorPage.js) starts H5P's editor (./client/editorStart.js), loads the parameters
 *      and saves through the content API; a structural save that would reset other people's progress opens the save
 *      choice (./client/editorSaveChoice.js, PROD-013, D-093).
 * Spec: H5P-002, H5P-007, SEC-008, UD-010, DATA-011, UD-002, PROD-003, PROD-013
 * Invariants:
 *   - Every value is escaped; both JSON blocks go through `scriptJson`.
 *   - The page has a `lang`, a title, one save button and a polite status region for save results (UD-006),
 *     followed by the error summary whose list names the errors of a refused save of a published activity
 *     (PROD-003, D-074), hidden while it is empty. The save button is rendered disabled; the boot script enables it
 *     once H5P's editor can save, and says meanwhile that the activity is opening (`messages.loading`).
 *   - The blocked-save text matches where the page runs: in Canvas (ltik token) it does not send the author to
 *     unpublish, which only the portal's "Sjekk og publiser" offers.
 *   - The save choice matches it too (`inCanvas`, `saveChoice`): Canvas offers reset or cancel with a pointer to the
 *     portal, the portal also «Lagre som ny versjon» (D-098).
 *   - First scripts are only same-origin static files (`/static/…js`), e.g. the LTI landing script.
 *   - The server pages' stylesheet comes after H5P's styles, so the save button and the status use the token
 *     typography, colours and target size like every server page (UD-002, UD-005, D-067); the editor keeps its
 *     full width. The save choice's stylesheet comes after it.
 * SPEC-DEVIATION: D-070 — the page's own <script>/<link> tags carry no integrity or nonce (H5P-009):
 *   same-origin files allowed by 'self' (amendment of 2026-10-24).
 * Collaborators: ./editorIntegration.ts, ./playerPage.ts (shared boot script and first-script check),
 *   ./scriptJson.ts, ../../http/routes/editorRoutes.ts, ../../lti/play/ltiEditRoutes.ts,
 *   ../../http/pages/pageAssetRoutes.ts (the stylesheets), ../../learningDesign/safeEditing/saveChoiceMessages.ts.
 * Tests: apps/server/test/h5p/render/editorPage.test.ts, apps/server/test/http/pages/serverPages.browser.test.ts,
 *   apps/server/test/h5p/editorBlockedSave.browser.int.test.ts, apps/server/test/h5p/editorReadiness.browser.int.test.ts
 */
import type { IIntegration } from '@lumieducation/h5p-server';
import { EDITOR_SAVE_CHOICE_STYLESHEET, SERVER_PAGES_STYLESHEET } from '../../http/pages/pageAssetRoutes.js';
import { t, type Locale } from '../../i18n/translate.js';
import { saveChoiceMessages } from '../../learningDesign/safeEditing/saveChoiceMessages.js';
import type { UrlToken } from '../HvlH5pUser.js';
import { firstScriptTags, H5P_INTEGRATION_SCRIPT } from './playerPage.js';
import { escapeHtml, scriptJson } from './scriptJson.js';

/** Where the H5P router serves ./client/editorPage.js. */
export const EDITOR_BOOT_SCRIPT = '/h5p/boot/editorPage.js';
/** Where the H5P router serves ./client/editorFields.js, which the boot script needs ("Gå til feltet"). */
export const EDITOR_FIELDS_SCRIPT = '/h5p/boot/editorFields.js';
/** Where the H5P router serves ./client/editorFieldReveal.js, which editorFields.js needs (opening a hidden field). */
export const EDITOR_FIELD_REVEAL_SCRIPT = '/h5p/boot/editorFieldReveal.js';
/** Where the H5P router serves ./client/editorSaveRequests.js, the boot script's requests (load, save, copy). */
export const EDITOR_SAVE_REQUESTS_SCRIPT = '/h5p/boot/editorSaveRequests.js';
/** Where the H5P router serves ./client/editorSaveChoice.js, the save choice dialog of PROD-013. */
export const EDITOR_SAVE_CHOICE_SCRIPT = '/h5p/boot/editorSaveChoice.js';
/** Where the H5P router serves ./client/editorStart.js, which starts H5P's editor and says when it can save. */
export const EDITOR_START_SCRIPT = '/h5p/boot/editorStart.js';

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
  const first = firstScriptTags(input.firstScripts);
  const inCanvas = input.token?.name === 'ltik';
  const config = {
    contentId: input.contentId ?? null,
    token: input.token ?? null,
    inCanvas,
    saveChoice: saveChoiceMessages(language, inCanvas),
    messages: {
      // WHY: the status while H5P's editor opens the activity and «Lagre» waits for it (./client/editorStart.js).
      loading: t('page.loading', {}, language),
      saving: t('page.editor.saving', {}, language),
      saved: t('page.editor.saved', {}, language),
      failed: t('page.editor.saveFailed', {}, language),
      // WHY: `{{count}}` stays literal (no param given); editorPage.js fills in the number of open errors.
      blockedErrors: t('page.editor.blockedErrors', {}, language),
      blocked: t(inCanvas ? 'page.editor.blockedSaveCanvas' : 'page.editor.blockedSave', {}, language),
      errorLabel: t('page.editor.errorLabel', {}, language),
      goToField: t('page.editor.goToField', {}, language),
      fieldNotReached: t('page.editor.fieldNotReached', {}, language),
      titleNotReached: t('page.editor.titleNotReached', {}, language),
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
    `<link rel="stylesheet" href="${EDITOR_SAVE_CHOICE_STYLESHEET}">`,
    ...input.scripts.map((src) => `<script src="${escapeHtml(src)}"></script>`),
    '</head>',
    '<body>',
    '<main class="hvl-editor">',
    '<div class="h5p-create"><div class="h5p-editor"></div></div>',
    `<p><button type="button" id="hvl-editor-save" disabled>${escapeHtml(t('page.editor.save', {}, language))}</button></p>`,
    '<p id="hvl-editor-status" role="status" aria-live="polite"></p>',
    // WHY: the summary's stylesheet rules (no bullets, no indent) are for a list inside it, as on the other pages.
    '<div class="hvl-error-summary" hidden><ul id="hvl-editor-findings"></ul></div>',
    '</main>',
    `<script src="${EDITOR_FIELD_REVEAL_SCRIPT}"></script>`,
    `<script src="${EDITOR_FIELDS_SCRIPT}"></script>`,
    `<script src="${EDITOR_SAVE_REQUESTS_SCRIPT}"></script>`,
    `<script src="${EDITOR_SAVE_CHOICE_SCRIPT}"></script>`,
    `<script src="${EDITOR_START_SCRIPT}"></script>`,
    `<script src="${EDITOR_BOOT_SCRIPT}"></script>`,
    '</body>',
    '</html>',
  ].join('\n');
}
