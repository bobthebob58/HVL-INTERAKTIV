/**
 * HvlTranslationCallback — translates Lumi's own H5P strings, Nynorsk first, then Bokmål, then English.
 *
 * Why: Lumi's editor, player, LibraryManager and content-type list call one synchronous translation
 *      function with a key such as `copyright-semantics:title` and the user's language. HVL serves
 *      Nynorsk by default and lets each user choose nb or en (H5P-008, D-046). Library language files
 *      take the same nn → nb → en route through ./storage/LanguageFallbackLibraryStorage.ts.
 * Spec: H5P-008
 * Invariants:
 *   - One i18next instance per callback, `lng: 'nn'`, `fallbackLng: ['nb', 'en']`, initialised
 *     synchronously, so the callback answers from the first call on.
 *   - Any language is reduced to nn, nb or en; anything unknown or missing becomes nn.
 *   - On a miss (no language has the key, or the key names a group instead of a string) the key is
 *     returned unchanged. Lumi treats a result that contains the key as "not translated" and keeps its
 *     own English text; its SemanticsLocalizer passes plain labels such as "Note: text" through us.
 *   - Strings are returned verbatim: no interpolation, nesting or HTML escaping (H5P fills `:name`
 *     placeholders itself, and its strings contain markup such as `<strong>`).
 * Collaborators: ./h5pTranslationResources.ts, ../i18n/translate.ts (Locale, DEFAULT_LOCALE); passed to
 *   Lumi's H5PEditor and H5PPlayer by the factories.
 * Tests: apps/server/test/h5p/HvlTranslationCallback.test.ts
 */
import { createInstance, type Resource } from 'i18next';
import type { ITranslationFunction } from '@lumieducation/h5p-server';
import { DEFAULT_LOCALE, type Locale } from '../i18n/translate.js';
import { loadH5pTranslationResources } from './h5pTranslationResources.js';

/** The languages i18next tries after the requested one, in order (H5P-008). */
export const H5P_FALLBACK_LANGUAGES: readonly Locale[] = ['nb', 'en'];

// WHY: i18next's own "missing" result is the key without its namespace, which Lumi's SemanticsLocalizer
// would then show instead of the label it passed in; a value no translation can contain marks a miss.
const MISSING = '\u0000hvl-h5p-translation-missing\u0000';

/** Primary language subtags (ISO 639-1 and 639-2) mapped to the three languages HVL serves. */
// SECURITY: a Map, not an object literal, so codes such as "constructor" or "__proto__" from a request
// cannot pick up Object.prototype members instead of a language.
const PRIMARY_LANGUAGE: ReadonlyMap<string, Locale> = new Map([
  ['nn', 'nn'],
  ['nno', 'nn'],
  ['nb', 'nb'],
  ['nob', 'nb'],
  // WHY: "no" (Norwegian, macrolanguage) means Bokmål in CLDR locale data and in practice; the old
  // Nynorsk spellings "no-NY" and "no-nyn" are recognised below.
  ['no', 'nb'],
  ['nor', 'nb'],
  ['en', 'en'],
  ['eng', 'en'],
]);

/** Subtags that turn the generic Norwegian codes into Nynorsk, e.g. `no-NO-NY`, `no-nyn`. */
const NYNORSK_SUBTAGS: ReadonlySet<string> = new Set(['ny', 'nyn', 'nynorsk']);
const GENERIC_NORWEGIAN: ReadonlySet<string> = new Set(['no', 'nor']);

/**
 * Reduces a language code from a user, a browser or Lumi to one of the languages HVL serves.
 * @param language - A BCP 47 or POSIX-style code such as `nn`, `nb-NO`, `nb_NO`, `no`, `en-GB`; may be empty.
 * @returns `nn`, `nb` or `en`; `nn` for anything unknown or missing.
 * @spec H5P-008
 */
export function normaliseH5pLanguage(language: string | undefined): Locale {
  const code = typeof language === 'string' ? language : '';
  const [primary = '', ...subtags] = code.trim().toLowerCase().replaceAll('_', '-').split('-');
  const locale = PRIMARY_LANGUAGE.get(primary);
  if (locale === undefined) return DEFAULT_LOCALE;
  if (GENERIC_NORWEGIAN.has(primary) && subtags.some((tag) => NYNORSK_SUBTAGS.has(tag))) return 'nn';
  return locale;
}

/**
 * Creates the translation function HVL passes to Lumi's H5PEditor and H5PPlayer.
 * @param resources - i18next resources; defaults to Lumi's own nn, nb and en files.
 * @returns A synchronous `(key, language) => string` that tries the user's language, then nb, then en,
 *   and returns the key unchanged when none of them has a string for it.
 * @spec H5P-008
 * @example
 *   const t = createHvlTranslationCallback();
 *   t('client:fullscreen', 'nn'); // 'Full skjerm'
 *   t('client:fullscreen', 'en'); // 'Fullscreen'
 */
export function createHvlTranslationCallback(
  resources: Resource = loadH5pTranslationResources(),
): ITranslationFunction {
  const i18n = createInstance();
  // WHY: initAsync false loads the in-memory resources before init returns; Lumi's translation function
  // is synchronous and may be called before any promise could settle.
  void i18n.init({
    lng: DEFAULT_LOCALE,
    fallbackLng: [...H5P_FALLBACK_LANGUAGES],
    resources,
    ns: [...new Set(Object.values(resources).flatMap((namespaces) => Object.keys(namespaces)))],
    // WHY: a key without a namespace is a plain label from a library's semantics, never one of our keys.
    defaultNS: false,
    initAsync: false,
    // WHY: an empty or null string in nn is a missing translation, so the next language is tried.
    returnEmptyString: false,
    returnNull: false,
    interpolation: { escapeValue: false },
  });
  return (key, language) => {
    const value: unknown = i18n.t(key, {
      lng: normaliseH5pLanguage(language),
      defaultValue: MISSING,
      // WHY: a key that names a group (e.g. `hub:H5P_Accordion`) yields an object, which is not a string.
      returnObjects: true,
      // WHY: H5P strings use `:name` placeholders filled by H5P core; `{{…}}` and `$t(…)` stay literal.
      skipInterpolation: true,
    });
    return typeof value === 'string' && value !== MISSING ? value : key;
  };
}
