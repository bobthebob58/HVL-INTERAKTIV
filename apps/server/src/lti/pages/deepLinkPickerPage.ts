/**
 * deepLinkPickerPage — the HTML of the Deep Linking picker: the author's activities as a list of choices.
 *
 * Why: LTI-005 lets a teacher pick activities in Canvas. In S3 the page is a small server-rendered form (D-048);
 *      its script (./client/deepLinkPicker.js) sends the choice with the ltik as a Bearer token and posts the
 *      signed answer to Canvas. Next.js replaces the page in S4.
 * Spec: LTI-005, PROD-005, LTI-003
 * Invariants:
 *   - Checkboxes only when the platform accepts several items (`accept_multiple === true`), else radio buttons.
 *   - Drafts are listed but disabled, with the reason in text tied to the input (D-061; not by colour alone).
 *   - The graded placement says the points are formative, never exam evidence.
 *   - The formative-use notice (PROD-011) is shown unless the teacher dismissed its current version; its button
 *     carries that version for ./client/deepLinkPicker.js.
 *   - Every text comes from the locale files; every value is escaped (`markup`).
 * Collaborators: ../deepLinking/deepLinkRoutes.ts, ./client/deepLinkPicker.js, ../../http/pages/htmlPage.ts.
 * Tests: apps/server/test/lti/pages/deepLinkPickerPage.test.ts
 */
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
}

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

function choice(
  activity: PickerActivity,
  index: number,
  type: 'checkbox' | 'radio',
  locale: Locale,
): SafeHtml {
  const id = `activity-${index}`;
  if (activity.selectable) {
    return markup`<li><input type="${type}" name="contentId" id="${id}" value="${activity.id}">
<label for="${id}">${activity.title}</label></li>`;
  }
  // A11Y: the reason a draft cannot be chosen is read out with the disabled input, not shown by greying alone.
  return markup`<li><input type="${type}" name="contentId" id="${id}" value="${activity.id}" disabled aria-describedby="${id}-draft">
<label for="${id}">${activity.title}</label> <span id="${id}-draft">(${t('deepLink.draft', {}, locale)})</span></li>`;
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
<p id="deep-link-status" role="status"></p>
<p id="deep-link-error" role="alert"></p>`;
  const notice = input.noticeVersion === undefined ? undefined : formativeNotice(locale, input.noticeVersion);
  const main = markup`<h1 tabindex="-1">${title}</h1>
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
