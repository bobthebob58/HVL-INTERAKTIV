/**
 * LocaleContext — gives client components the page's locale, which the root layout read from Express's header.
 *
 * Why: server components read the locale per request (./requestLocale.ts), but client components cannot read request
 *      headers. The layout passes the one decision down, so every string on a page is in the same language (UD-010).
 * Spec: PROD-012, UD-010
 * Invariants:
 *   - Without a provider the locale is Nynorsk, the default (PROD-012).
 * Collaborators: ../app/layout.tsx (provides it), ./translate.ts, the client components under ../components.
 * Tests: apps/web/test/components/ExternalLink.test.tsx (through the components that use it)
 */
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './translate';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/**
 * Provides the page's locale to the client components below it.
 * @param props - The locale and the tree that uses it.
 * @returns The provider.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/**
 * The page's locale.
 * @returns `nn`, `nb` or `en`.
 */
export const useLocale = (): Locale => useContext(LocaleContext);
