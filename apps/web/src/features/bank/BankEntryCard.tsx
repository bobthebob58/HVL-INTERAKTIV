/**
 * BankEntryCard — one activity in the HVL content bank: its title, type, phase, purpose, time, outcomes and the
 * colleague who shared it, with «Lag ein kopi».
 *
 * Why: D-091 shows colleagues what they need to choose an activity to copy and adapt (PROD-007); the server sends
 *      only what may be shown (never the rationale or the course code) and the owner's current name.
 * Spec: PROD-007, PED-032, UD-010, UD-006
 * Invariants:
 *   - A11Y: each entry is an `article` named by its `h2`; the title and the purpose carry the activity's own
 *     language when it differs from the page's (WCAG 3.1.2); the copy button's accessible name names the activity
 *     (WCAG 2.4.6), starting with its visible text (WCAG 2.5.3).
 *   - The phase label comes from the studio content (`phaseLabel`), never from this file (PED-001); a phase the
 *     content no longer has is left out.
 * Collaborators: ./BankWorkspace.tsx, ../sharing/DuplicateButton.tsx, ../../i18n/contentTypeName.ts,
 *   ../../i18n/partLanguage.ts.
 * Tests: apps/web/test/features/BankView.test.tsx
 */
'use client';

import type { BankEntry } from '@hvl-interaktiv/api-contract';
import { useId, type ReactNode } from 'react';
import { contentTypeName } from '../../i18n/contentTypeName';
import { formatDate } from '../../i18n/formatDate';
import { useLocale } from '../../i18n/LocaleContext';
import { partLanguage } from '../../i18n/partLanguage';
import { t } from '../../i18n/translate';
import { DuplicateButton } from '../sharing/DuplicateButton';

/** What the card needs. */
export interface BankEntryCardProps {
  readonly entry: BankEntry;
  /** The label of the entry's phase in the page's language, when the studio content has it. */
  readonly phaseLabel?: string;
  /** Opens a page; the browser's own navigation by default. */
  readonly navigate?: (path: string) => void;
}

/**
 * One bank entry.
 * @param props - The entry, its phase label and the navigation.
 * @returns The card.
 */
export function BankEntryCard({ entry, phaseLabel, navigate }: BankEntryCardProps) {
  const locale = useLocale();
  const headingId = useId();
  const lang = partLanguage(entry.language, locale);
  const minutes = entry.estimatedStudentMinutes;
  const fact = (term: string, value: ReactNode, valueLang?: string) => (
    <div className="mt-1">
      <dt className="inline font-bold">{term}: </dt>
      <dd className="m-0 inline" lang={valueLang}>
        {value}
      </dd>
    </div>
  );
  return (
    <article aria-labelledby={headingId} className="mb-6 border-l-4 border-hvl-primary-dark pl-3">
      <h2 id={headingId} lang={lang} className="text-xl">
        {entry.title}
      </h2>
      <dl className="m-0">
        {fact(t('bank.type', locale), contentTypeName(entry.mainLibrary, locale))}
        {phaseLabel ? fact(t('bank.phase', locale), phaseLabel) : null}
        {minutes !== undefined
          ? fact(
              t('bank.time', locale),
              minutes === 1 ? t('bank.minutesOne', locale) : t('bank.minutesOther', locale, { minutes }),
            )
          : null}
        {entry.learnerPurpose ? fact(t('bank.purpose', locale), entry.learnerPurpose, lang) : null}
        {fact(t('bank.owner', locale), entry.ownerName ?? t('bank.ownerUnknown', locale))}
        {fact(t('bank.listedAt', locale), formatDate(entry.listedAt, locale))}
      </dl>
      {entry.outcomes.length > 0 ? (
        <>
          <p className="m-0 mt-1 font-bold">{t('bank.outcomes', locale)}:</p>
          <ul className="m-0 pl-6" lang={lang}>
            {entry.outcomes.map((outcome, index) => (
              <li key={`${index}-${outcome.text}`}>{outcome.text}</li>
            ))}
          </ul>
        </>
      ) : null}
      <DuplicateButton
        contentId={entry.contentId}
        accessibleName={t('sharing.duplicateOf', locale, { title: entry.title })}
        {...(navigate ? { navigate } : {})}
      />
    </article>
  );
}
