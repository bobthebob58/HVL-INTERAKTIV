/**
 * deepLinkPickerPage — the HTML of the Deep Linking picker: the author's activities as a list of choices.
 *
 * Why: LTI-005 lets a teacher pick activities in Canvas. In S3 the page is a small server-rendered form (D-048);
 *      its script (./client/deepLinkPicker.js) sends the choice with the ltik as a Bearer token and posts the
 *      signed answer to Canvas. It stays server-rendered in S4, with the token CSS (D-067 amendment).
 * Spec: LTI-005, PROD-005, LTI-003, UD-013, LTI-013
 * Invariants:
 *   - Checkboxes only when the platform accepts several items (`accept_multiple === true`), else radio buttons.
 *   - Drafts are listed but disabled, with the reason in text tied to the input (D-061; not by colour alone).
 *   - The graded placement says the points are formative, never exam evidence, and an activity that can never send
 *     Canvas a score says so and why, in text tied to its input like a draft's reason (D-115).
 *   - The formative-use notice (PROD-011) is shown unless the teacher dismissed its current version; its button
 *     carries that version for ./client/deepLinkPicker.js.
 *   - Errors go into the summary right below the heading (`#deep-link-errors`, hidden until the script fills it),
 *     which links to the field it is about; the choices' fieldset names it with `aria-describedby` (UD-013).
 *   - The page has the Hjelp header, opening a new tab, when the route passes `help` (the web app runs, UD-013).
 *   - Every text comes from the locale files; every value is escaped (`markup`).
 * Collaborators: ../deepLinking/deepLinkRoutes.ts, ./client/deepLinkPicker.js, ../../http/pages/htmlPage.ts,
 *   ../../http/pages/helpLink.ts.
 * Tests: apps/server/test/lti/pages/deepLinkPickerPage.test.ts, apps/server/test/lti/pages/deepLinkPicker.browser.test.ts
 */
import type { HelpLink } from '../../http/pages/helpLink.js';
import { htmlPage, markup, type SafeHtml } from '../../http/pages/htmlPage.js';
import { t, type Locale } from '../../i18n/translate.js';
import type { PickerActivity } from '../deepLinking/deepLinkActivities.js';

/** The picker's script, served by ../play/ltiPlayRoutes.ts. */
export const DEEP_LINK_PICKER_SCRIPT = '/static/lti/deepLinkPicker.js';

/** Where the picker's script sends the choice. */
export const DEEP_LINK_RESPONSE_PATH = '/lti/deeplink/response';

/** What the picker shows. */
export interface DeepLinkPickerInput {
  readonly locale: Locale;
  /** Own and co-authored activities (./deepLinkActivities.ts). */
  readonly activities: readonly PickerActivity[];
  /** The platform accepts several items. */
  readonly multiple: boolean;
  /** The placement creates a gradebook column (`assignment_selection`). */
  readonly graded: boolean;
  /** The current version of the formative-use notice, or undefined when the teacher dismissed it. */
  readonly noticeVersion?: number;
  /** The header's Hjelp link, when the web app runs (../../http/pages/helpLink.ts). */
  readonly help?: HelpLink | undefined;
}

/** The marker before each problem in the error summary (✗), as in the web app; the text carries the meaning. */
const ERROR_ICON = '✗';

/**
 * The formative-use notice (PROD-011), dismissible.
 * @param locale - The page language.
 * @param version - The notice version the dismiss button records.
 * @returns The notice markup.
 */
function formativeNotice(locale: Locale, version: number): SafeHtml {
  return markup`<section class="hvl-notice" id="formative-notice" aria-labelledby="formative-notice-title">
<h2 id="formative-notice-title">${t('notice.formativeUse.title', {}, locale)}</h2>
<p>${t('notice.formativeUse.body', {}, locale)}</p>
<button type="button" data-notice-version="${version}">${t('notice.formativeUse.dismiss', {}, locale)}</button>
</section>`;
}

/**
 * The error summary, empty and hidden until ./client/deepLinkPicker.js reports a problem in it.
 * @param locale - The page language.
 * @returns The summary markup.
 */
function errorSummary(locale: Locale): SafeHtml {
  // A11Y: UD-013: a summary at the top that takes focus; the script links its problem to the field.
  return markup`<div id="deep-link-errors" class="hvl-error-summary" role="alert" tabindex="-1" aria-labelledby="deep-link-errors-title" hidden>
<h2 id="deep-link-errors-title">${t('deepLink.errorSummaryTitle', {}, locale)}</h2>
<ul><li><span aria-hidden="true">${ERROR_ICON} </span><span id="deep-link-error"></span></li></ul>
</div>`;
}

/**
 * The note that Canvas will get no score from an activity (D-115), with its ID for `aria-describedby`.
 * @param activity - The listed activity; only one with `noScore` gets a note.
 * @param id - The activity's input ID.
 * @param locale - The page language.
 * @returns The note's ID and markup, or undefined.
 */
function noScoreNote(
  activity: PickerActivity,
  id: string,
  locale: Locale,
): { readonly id: string; readonly html: SafeHtml } | undefined {
  if (!activity.noScore) return undefined;
  const noteId = `${id}-no-score`;
  // PEDAGOGY: the teacher learns before placing it that the gradebook column will stay empty, and how to change that.
  return {
    id: noteId,
    html: markup` <span id="${noteId}">${t(`deepLinkGrading.noScore.${activity.noScore}`, {}, locale)}</span>`,
  };
}

function choice(
  activity: PickerActivity,
  index: number,
  type: 'checkbox' | 'radio',
  locale: Locale,
): SafeHtml {
  const id = `activity-${index}`;
  const note = noScoreNote(activity, id, locale);
  if (activity.selectable) {
    const described = note ? markup` aria-describedby="${note.id}"` : undefined;
    return markup`<li><input type="${type}" name="contentId" id="${id}" value="${activity.id}"${described}>
<label for="${id}">${activity.title}</label>${note?.html}</li>`;
  }
  // A11Y: the reason a draft cannot be chosen is read out with the disabled input, not shown by greying alone.
  const describedBy = note ? `${id}-draft ${note.id}` : `${id}-draft`;
  return markup`<li><input type="${type}" name="contentId" id="${id}" value="${activity.id}" disabled aria-describedby="${describedBy}">
<label for="${id}">${activity.title}</label> <span id="${id}-draft">(${t('deepLink.draft', {}, locale)})</span>${note?.html}</li>`;
}

/**
 * Builds the picker page.
 * @param input - Language, activities, whether several may be chosen, and whether the placement is graded.
 * @returns The HTML document.
 */
export function deepLinkPickerPage(input: DeepLinkPickerInput): string {
  const { locale, activities, multiple, graded } = input;
  const title = t('deepLink.title', {}, locale);
  const type = multiple ? 'checkbox' : 'radio';
  // PEDAGOGY: H5P scores are formative; the teacher is told before Canvas makes an assignment of them.
  const gradedNote = graded ? markup`<p>${t('deepLink.graded', {}, locale)}</p>` : undefined;
  const form =
    activities.length === 0
      ? markup`<p>${t('deepLink.empty', {}, locale)}</p>`
      : markup`<form id="deep-link-form" method="post" novalidate>
<fieldset>
<legend>${t('deepLink.legend', {}, locale)}</legend>
<ul>
${activities.map((activity, index) => choice(activity, index, type, locale))}
</ul>
</fieldset>
<button type="submit">${t('deepLink.submit', {}, locale)}</button>
</form>
<p id="deep-link-status" role="status"></p>`;
  const notice = input.noticeVersion === undefined ? undefined : formativeNotice(locale, input.noticeVersion);
  const main = markup`<h1 tabindex="-1">${title}</h1>
${activities.length === 0 ? undefined : errorSummary(locale)}
${notice}
<p>${t(multiple ? 'deepLink.introMultiple' : 'deepLink.intro', {}, locale)}</p>
${gradedNote}
<noscript><p>${t('page.noscript', {}, locale)}</p></noscript>
${form}`;
  return htmlPage(
    {
      locale,
      title,
      main,
      help: input.help,
      scripts: [DEEP_LINK_PICKER_SCRIPT],
      bodyData: {
        'response-url': DEEP_LINK_RESPONSE_PATH,
        'msg-sending': t('deepLink.sending', {}, locale),
        'msg-none': t('deepLink.noneChosen', {}, locale),
        'msg-failed': t('deepLink.failed', {}, locale),
      },
    },
    t('page.siteName', {}, locale),
  );
}
