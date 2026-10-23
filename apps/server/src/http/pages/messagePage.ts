/**
 * messagePage — the friendly page for a refusal or a notice: a heading, a sentence and at most one link.
 *
 * Why: a learner who opens an unavailable activity, a teacher whose Canvas access expired, or a user who just
 *      logged out should read a clear sentence in their own language, never a stack trace or a JSON body
 *      (PROD-004, LTI-001 friendly error pages, D-066).
 * Spec: PROD-004, LTI-001, LTI-003, PROD-012
 * Invariants:
 *   - Every string comes from the locale files; nothing from the request is shown.
 *   - The link, if any, is a same-origin path (`/…`, never `//…`), so a page can never send the user elsewhere.
 * Collaborators: ./htmlPage.ts, ../../i18n/translate.ts, ../routes/playerRoutes.ts, ../../lti/http/ltiErrorPages.ts.
 * Tests: apps/server/test/http/pages/messagePage.test.ts
 */
import { t, type Locale, type MessageKey } from '../../i18n/translate.js';
import { htmlPage, markup } from './htmlPage.js';

/** A link the page offers, e.g. "Log in with Feide". */
export interface PageAction {
  /** Same-origin path, e.g. `/auth/feide/login?returnTo=%2F`. */
  readonly href: string;
  /** Locale key of the link text. */
  readonly labelKey: MessageKey;
}

/** What a message page says. */
export interface MessagePageInput {
  /** Language of the page. */
  readonly locale: Locale;
  /** Locale key of the heading (also the page title). */
  readonly titleKey: MessageKey;
  /** Locale key of the sentence below it. */
  readonly bodyKey: MessageKey;
  /** The page's one link, if any. */
  readonly action?: PageAction;
}

/**
 * Builds a message page.
 * @param input - Language, heading, sentence and optional link.
 * @returns The HTML document.
 * @throws Error when the link is not a same-origin path (a programming error).
 */
export function messagePage(input: MessagePageInput): string {
  const { locale, titleKey, bodyKey, action } = input;
  // SECURITY: `//host` and `/\host` are protocol-relative in browsers; only plain paths are links here.
  if (action && !/^\/(?![/\\])/.test(action.href)) throw new Error('message page links must be local paths');
  const title = t(titleKey, {}, locale);
  const link = action
    ? markup`<p><a href="${action.href}">${t(action.labelKey, {}, locale)}</a></p>`
    : undefined;
  const main = markup`<h1>${title}</h1>
<p>${t(bodyKey, {}, locale)}</p>
${link}`;
  return htmlPage({ locale, title, main }, t('page.siteName', {}, locale));
}
