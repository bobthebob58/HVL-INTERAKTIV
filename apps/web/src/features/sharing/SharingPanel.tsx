/**
 * SharingPanel — the **Deling** tab's content: who can find the activity, its co-authors, its place in the content
 * bank, and «Lag ein kopi».
 *
 * Why: D-089 gathers an activity's sharing on one tab for people who may edit it: visibility (PROD-006, which until
 *      S5 had only an API), co-authors (D-090), the bank (D-091) and duplicating (D-092). Each part asks the server
 *      itself, which decides every right again.
 * Spec: PROD-007, PROD-006, UD-006
 * Invariants:
 *   - A11Y: one `h2` for the tab; the visibility is a fieldset with its legend, and the co-authors, the bank and the
 *     copy each a section named by its `h3`, in a fixed order (WCAG 1.3.1, 2.4.6).
 *   - The panel is shown only to people who may edit (`forEditors`); the parts that only the owner may change say so.
 * Collaborators: ../activity/tabs/SharingTab.tsx, ./VisibilityControl.tsx, ./CoAuthorSection.tsx,
 *   ./BankListingSection.tsx, ./DuplicateButton.tsx.
 * Tests: apps/web/test/features/SharingPanel.test.tsx
 */
'use client';

import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { BankListingSection } from './BankListingSection';
import { CoAuthorSection } from './CoAuthorSection';
import { DuplicateButton } from './DuplicateButton';
import { VisibilityControl } from './VisibilityControl';

/** What the panel needs. */
export interface SharingPanelProps {
  readonly detail: ContentDetail;
  /** Says something in the page's polite status region. */
  readonly announce: (message: string) => void;
  /** Loads the activity again after its visibility changed. */
  readonly reloadDetail: () => Promise<void>;
  /** Opens a page; the browser's own navigation by default (tests pass their own). */
  readonly navigate?: (path: string) => void;
}

/**
 * The **Deling** tab's sections.
 * @param props - The activity, the page's announcer and reload, and the navigation.
 * @returns The panel.
 */
export function SharingPanel({ detail, announce, reloadDetail, navigate }: SharingPanelProps) {
  const locale = useLocale();
  const bankId = useId();
  const copyId = useId();
  return (
    <>
      <h2>{t('sharing.heading', locale)}</h2>
      <VisibilityControl detail={detail} announce={announce} reloadDetail={reloadDetail} />
      <CoAuthorSection contentId={detail.id} announce={announce} />
      <section aria-labelledby={bankId} className="mb-6">
        <h3 id={bankId}>{t('sharing.bankHeading', locale)}</h3>
        <BankListingSection detail={detail} announce={announce} />
      </section>
      <section aria-labelledby={copyId}>
        <h3 id={copyId}>{t('sharing.duplicateHeading', locale)}</h3>
        <p>{t('sharing.duplicateIntro', locale)}</p>
        <DuplicateButton contentId={detail.id} announce={announce} {...(navigate ? { navigate } : {})} />
      </section>
    </>
  );
}
