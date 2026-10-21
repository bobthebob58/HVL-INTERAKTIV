/**
 * translate — looks up user-facing server messages in Nynorsk, Bokmål or English.
 *
 * Why: every string a user can see lives in locale files, never in code (DOC-009), and Nynorsk is the
 *      default language of the service (PROD-012, D-009). Typed keys make a missing message a compile error.
 * Spec: PROD-012, DOC-009
 * Invariants:
 *   - `nn.json` is the reference: `MessageKey` is derived from it, and doc-lint requires nb and en to
 *     have exactly the same keys.
 *   - Lookup falls back from the requested locale through nn → nb → en, as H5P strings do.
 *   - `{{name}}` placeholders are filled from `params`; an unknown placeholder is left visible.
 * Collaborators: ./locales/*.json; callers that return errors to users (e.g. ../security/zipEntryGuard.ts).
 * Tests: apps/server/test/i18n/translate.test.ts
 */
import nn from './locales/nn.json' with { type: 'json' };
import nb from './locales/nb.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };

/** Supported locales, default first. */
export const LOCALES = ['nn', 'nb', 'en'] as const;
/** A supported locale code. */
export type Locale = (typeof LOCALES)[number];
/** The default locale (Nynorsk). */
export const DEFAULT_LOCALE: Locale = 'nn';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every message key, as a dotted path such as `upload.archive.unreadable`. */
export type MessageKey = Leaves<typeof nn>;

const CATALOGUES: Record<Locale, unknown> = { nn, nb, en };

const lookup = (catalogue: unknown, key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], catalogue);
  return typeof value === 'string' ? value : undefined;
};

/**
 * Tells whether a string is a supported locale code.
 * @param value - Candidate code, e.g. from a launch claim.
 * @returns True for `nn`, `nb` and `en`.
 */
export const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/**
 * Returns the message for `key` in `locale`, with placeholders filled.
 * @param key - Message key.
 * @param params - Values for `{{name}}` placeholders.
 * @param locale - Requested locale; Nynorsk by default.
 * @returns The translated text, or the key itself if no catalogue has it (never thrown at users).
 */
export function t(
  key: MessageKey,
  params: Record<string, string | number> = {},
  locale: Locale = DEFAULT_LOCALE,
): string {
  const chain = [locale, ...LOCALES.filter((l) => l !== locale)];
  const template = chain.map((l) => lookup(CATALOGUES[l], key)).find((text) => text !== undefined) ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
