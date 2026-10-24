/**
 * partLanguage — the `lang` attribute of a part of the page written in another language than the page itself, such as
 * an activity's title in the Canvas chrome.
 *
 * Why: WCAG 3.1.2 Language of Parts (AA, spec 03 §1) and UD-010: the page language follows the UI locale, but an
 *      activity's title is the author's text in the activity's own language (the server's `activityLanguage`:
 *      `defaultLanguage`, else h5p.json's `language`, which Lumi defaults to `en`; D-069). Under an English page a
 *      Nynorsk title would otherwise be read with an English voice.
 * Spec: UD-010
 * Invariants:
 *   - Only a language tag that differs from the page's primary language is returned; the same language needs no `lang`.
 *   - No tag (the activity states none) means no attribute: the part is then in the page language as far as we know.
 * Collaborators: ../features/lti/LtiPlayView.tsx, ../lti/launchHeader.ts, ../features/activity/ActivityView.tsx,
 *   ../features/portal/ActivityList.tsx.
 * Tests: apps/web/test/i18n/partLanguage.test.ts
 */
import type { Locale } from './translate';

/**
 * The `lang` for a part of the page.
 * @param language - The part's language tag, e.g. `nn` or `en-GB`, if known.
 * @param locale - The page's locale.
 * @returns The tag when it differs from the page language, else undefined.
 */
export function partLanguage(language: string | undefined, locale: Locale): string | undefined {
  if (!language) return undefined;
  const primary = language.split('-')[0]?.toLowerCase();
  return primary === locale ? undefined : language;
}
