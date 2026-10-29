/**
 * saveChoiceMessages — the texts of the save choice dialog that the editor page shows when a save answers 409
 * `hvl:learner-state-reset-needed`, translated for the page, in the portal's or Canvas's variant.
 *
 * Why: PROD-013 and D-093: the dialog warns that structural changes (adding, removing or reordering questions or
 *      options) reset learners' saved progress and that rewording an option changes what saved choices mean, and
 *      offers «Avbryt», «Nullstill framgangen og lagre» and, in the portal, «Lagre som ny versjon». Canvas offers
 *      reset or cancel only, with a pointer to the portal (D-098). The editor page's boot script
 *      (`editorSaveChoice.js`, W5b) reads these from the page's config block, so every text comes from the locale
 *      files (DOC-009) and the two variants cannot drift apart.
 * Spec: PROD-013, PROD-012
 * Invariants:
 *   - Every text is a `safeEditing.*` locale key in nn, nb and en.
 *   - The Canvas variant has no copy button, hint, copy progress or copy outcome, and has the pointer; the portal
 *     variant has no pointer.
 * Collaborators: ../../i18n/translate.ts, ../../h5p/render/editorPage.ts (puts them in the page's config).
 * Tests: apps/server/test/learningDesign/safeEditing/saveChoiceMessages.test.ts
 */
import { t, type Locale } from '../../i18n/translate.js';

/** The dialog's texts as the editor page passes them to its boot script. */
export interface SaveChoiceMessages {
  readonly title: string;
  readonly body: string;
  /** «Avbryt»: focus starts here, Escape does the same. */
  readonly cancel: string;
  /** «Nullstill framgangen og lagre»: the retry with `confirmLearnerStateReset: true`. */
  readonly reset: string;
  /** «Lagre som ny versjon» (portal only): `POST /h5p/content/:contentId/copy`. */
  readonly saveAsCopy?: string;
  /** What «Lagre som ny versjon» does (portal only). */
  readonly saveAsCopyHint?: string;
  /** Why Canvas offers no copy, and where to make one (Canvas only). */
  readonly canvasPointer?: string;
  /** Announced while the confirmed reset and save runs. */
  readonly resetting: string;
  /** Announced after a confirmed reset and save. */
  readonly resetAndSaved: string;
  /** Announced while «Lagre som ny versjon» runs (portal only). */
  readonly copying?: string;
  /** Announced after «Lagre som ny versjon» (portal only). */
  readonly savedAsCopy?: string;
  /** Announced after «Avbryt». */
  readonly cancelled: string;
}

/**
 * The dialog's texts for one editor page.
 * @param language - The page language.
 * @param inCanvas - True for the editor inside Canvas (`/lti/edit`).
 * @returns The texts of that variant.
 * @spec PROD-013
 */
export function saveChoiceMessages(language: Locale, inCanvas: boolean): SaveChoiceMessages {
  const common = {
    title: t('safeEditing.dialog.title', {}, language),
    body: t('safeEditing.dialog.body', {}, language),
    cancel: t('safeEditing.dialog.cancel', {}, language),
    reset: t('safeEditing.dialog.reset', {}, language),
    resetting: t('safeEditing.busy.resetting', {}, language),
    resetAndSaved: t('safeEditing.outcome.resetAndSaved', {}, language),
    cancelled: t('safeEditing.outcome.cancelled', {}, language),
  };
  if (inCanvas) return { ...common, canvasPointer: t('safeEditing.dialog.canvasPointer', {}, language) };
  return {
    ...common,
    saveAsCopy: t('safeEditing.dialog.saveAsCopy', {}, language),
    saveAsCopyHint: t('safeEditing.dialog.saveAsCopyHint', {}, language),
    copying: t('safeEditing.busy.copying', {}, language),
    savedAsCopy: t('safeEditing.outcome.savedAsCopy', {}, language),
  };
}
