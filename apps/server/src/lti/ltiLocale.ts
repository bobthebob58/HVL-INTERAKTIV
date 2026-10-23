/**
 * ltiLocale — picks the UI language for an LTI launch from the locale Canvas sends.
 *
 * Why: every UI string exists in Nynorsk, Bokmål and English, Nynorsk first (PROD-012). An LTI launch carries the
 *      Canvas user's language as a BCP 47 tag, which must become one of those three; everything else falls back to
 *      Nynorsk.
 * Spec: PROD-012
 * Invariants:
 *   - The tag is `launch_presentation.locale`, else the top-level `locale` claim; the first non-blank string wins.
 *   - Its primary language subtag decides, ignoring case and with `-` or `_` separators: `nn` → nn; `nb` or `no`
 *     → nb; `en` → en; anything else, or no tag → nn.
 *   - The result is always a supported locale; the function never throws.
 * Collaborators: ../i18n/translate.ts (Locale, DEFAULT_LOCALE), ./ltikPrincipal.ts, ./launch/onResourceLink.ts.
 * Tests: apps/server/test/lti/ltiLocale.test.ts
 */
import { DEFAULT_LOCALE, type Locale } from '../i18n/translate.js';

/** The LTI claim that carries `locale`, among other presentation hints. */
const LAUNCH_PRESENTATION_CLAIM = 'https://purl.imsglobal.org/spec/lti/claim/launch_presentation';

/** Primary language subtags and the locale they select (a Map, so `__proto__` or `constructor` match nothing). */
const LOCALE_BY_LANGUAGE: ReadonlyMap<string, Locale> = new Map<string, Locale>([
  ['nn', 'nn'],
  ['nb', 'nb'],
  ['no', 'nb'],
  ['en', 'en'],
]);

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Maps a BCP 47 language tag to a supported locale.
 * @param tag - e.g. `nb-NO`, `en-GB`, `nn`.
 * @returns `nn`, `nb` or `en`; Nynorsk for anything else.
 * @spec PROD-012
 */
export function localeOfTag(tag: string): Locale {
  const [language = ''] = tag.trim().toLowerCase().split(/[-_]/, 1);
  return LOCALE_BY_LANGUAGE.get(language) ?? DEFAULT_LOCALE;
}

/**
 * The UI language of an LTI launch.
 * @param claims - The launch's ID-token claims (full at launch time, or the stored allowlist when resumed).
 * @returns `nn`, `nb` or `en`.
 * @spec PROD-012
 */
export function localeFromLaunch(claims: Readonly<Record<string, unknown>>): Locale {
  const presentation = claims[LAUNCH_PRESENTATION_CLAIM];
  const candidates = [isObject(presentation) ? presentation.locale : undefined, claims.locale];
  const tag = candidates.find((value): value is string => typeof value === 'string' && value.trim() !== '');
  return tag === undefined ? DEFAULT_LOCALE : localeOfTag(tag);
}
