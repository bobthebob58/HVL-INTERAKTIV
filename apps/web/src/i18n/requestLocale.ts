/**
 * requestLocale — the language of the page being rendered, as Express decided it.
 *
 * Why: Express knows the session or launch locale and is the only part that sees credentials (D-068). It passes the
 *      decision in one request header it always overwrites, so a client cannot choose a different value this way.
 * Spec: PROD-012, UD-010
 * Invariants:
 *   - Only `nn`, `nb` and `en` are accepted; anything else, or no header, is Nynorsk.
 *   - Reading request headers makes every page render per request, which the nonce policy needs (D-070).
 * Collaborators: ./translate.ts, apps/server/src/web/webRequestContract.ts (sets `x-hvli-locale`), ../app/layout.tsx.
 * Tests: apps/web/test/i18n/translate.test.ts, apps/server/test/web/webApp.browser.int.test.ts
 */
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, type Locale } from './translate';

/** The request header that carries Express's locale decision (same name in apps/server/src/web). */
export const LOCALE_HEADER = 'x-hvli-locale';

/**
 * Picks the locale from a header value.
 * @param value - The header value, if any.
 * @returns A supported locale.
 */
export const localeFromHeader = (value: string | null): Locale =>
  value !== null && isLocale(value) ? value : DEFAULT_LOCALE;

/**
 * The locale of the current request.
 * @returns A supported locale; Nynorsk when Express sent none.
 */
export async function requestLocale(): Promise<Locale> {
  return localeFromHeader((await headers()).get(LOCALE_HEADER));
}
