/**
 * translate — looks up the web app's user-facing text in Nynorsk, Bokmål or English.
 *
 * Why: every string a user can see lives in locale files, never in code (DOC-009), and Nynorsk is the default
 *      (PROD-012, D-009). The web app keeps its own catalogue with the server's key style and fallback (D-076).
 * Spec: PROD-012, DOC-009
 * Invariants:
 *   - `nn.json` is the reference: `MessageKey` is derived from it; doc-lint requires nb and en to have the same keys.
 *   - Lookup falls back from the requested locale through nn → nb → en; a missing key returns the key itself.
 *   - `{{name}}` placeholders are filled from `params`; an unknown placeholder is left visible.
 * Collaborators: ./locales/*.json, ./requestLocale.ts, the pages under ../app.
 * Tests: apps/web/test/i18n/translate.test.ts
 */
import en from './locales/en.json';
import nb from './locales/nb.json';
import nn from './locales/nn.json';

/** Supported locales, default first. */
export const LOCALES = ['nn', 'nb', 'en'] as const;
/** A supported locale code. */
export type Locale = (typeof LOCALES)[number];
/** The default locale (Nynorsk). */
export const DEFAULT_LOCALE: Locale = 'nn';

/** The dotted paths to every string in a nested object type, e.g. `help.title`. */
export type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every message key of the web app. */
export type MessageKey = Leaves<typeof nn>;

const CATALOGUES: Record<Locale, unknown> = { nn, nb, en };

const lookup = (catalogue: unknown, key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalogue);
  return typeof value === 'string' ? value : undefined;
};

/**
 * Tells whether a string is a supported locale code.
 * @param value - Candidate code, e.g. from the `x-hvli-locale` request header.
 * @returns True for `nn`, `nb` and `en`.
 */
export const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/**
 * Returns the text for `key` in `locale`, with placeholders filled.
 * @param key - Message key.
 * @param locale - Requested locale.
 * @param params - Values for `{{name}}` placeholders.
 * @returns The translated text, or the key itself if no catalogue has it.
 */
export function t(key: MessageKey, locale: Locale, params: Record<string, string | number> = {}): string {
  const chain = [locale, ...LOCALES.filter((l) => l !== locale)];
  const template = chain.map((l) => lookup(CATALOGUES[l], key)).find((text) => text !== undefined) ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
