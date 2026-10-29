/**
 * BankView — the HVL content bank's content (`/laeringsdesign/innhaldsbank`): published activities colleagues have
 * listed, to duplicate and adapt.
 *
 * Why: PROD-007 lets authors share activities with colleagues through the bank (D-091). It shows colleagues' names
 *      and work, so it is for signed-in authors only (D-089); the server decides who is an HVL staff author and
 *      refuses everyone else again, a student author with a reason the page explains (D-091 as amended).
 * Spec: PROD-007, AUTH-001
 * Invariants:
 *   - The heading is always shown; the content only to a signed-in author (../../components/AuthorGate.tsx).
 * Collaborators: ../../app/(portal)/laeringsdesign/innhaldsbank/page.tsx, ../../components/AuthorGate.tsx,
 *   ./BankWorkspace.tsx.
 * Tests: apps/web/test/features/BankView.test.tsx, apps/web/test/features/studioPages.test.tsx
 */
'use client';

import { AuthorGate } from '../../components/AuthorGate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { BankWorkspace } from './BankWorkspace';

/**
 * The content bank page's content.
 * @param props - Where «Lag ein kopi» goes: the browser's own navigation by default.
 * @returns The heading and, for authors, the bank.
 */
export function BankView({ navigate }: { readonly navigate?: (path: string) => void } = {}) {
  const locale = useLocale();
  return (
    <>
      <h1>{t('bank.heading', locale)}</h1>
      <AuthorGate>{() => <BankWorkspace {...(navigate ? { navigate } : {})} />}</AuthorGate>
    </>
  );
}
