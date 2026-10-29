/**
 * MappeWordCount — the `/mappe` page's word count: Del 1's words and the suggested attachments against the criteria
 * set's limits, announced politely, with an icon and a text prefix that say whether a limit is passed.
 *
 * Why: MAPPE-002 shows a live word count of Del 1 against the limit (7 500 in the 2025 call), the references and the
 *      reader's guide excluded. Over a limit is a warning, never a refusal (D-094): the teacher shortens the draft.
 * Spec: MAPPE-002, UD-006
 * Invariants:
 *   - A11Y: the count is a polite status region that stays mounted, so each new count is read (WCAG 4.1.3); the
 *     state is never told by colour alone: an icon and «Innanfor grensa:» or «Over grensa:» lead the text
 *     (CLAUDE.md §1, WCAG 1.4.1). The icon is hidden from screen readers, which read the prefix.
 *   - Colours come from the design tokens only.
 * Collaborators: ./MappeWorkspace.tsx, ./useMappePreview.ts, ../../components/FindingsList.tsx (`SEVERITY_ICON`).
 * Tests: apps/web/test/features/MappeView.test.tsx
 */
'use client';

import { useId } from 'react';
import { SEVERITY_ICON } from '../../components/FindingsList';
import { INTL_LOCALE } from '../../i18n/formatDate';
import { useLocale } from '../../i18n/LocaleContext';
import { t, type Locale, type MessageKey } from '../../i18n/translate';
import type { MappePreviewState } from './useMappePreview';

/** The icon of a count within the limits. */
const WITHIN_ICON = '✓';

/**
 * The word count.
 * @param props - The preview's state.
 * @returns A section with a heading and the count in a status region.
 */
export function MappeWordCount({ state }: { readonly state: MappePreviewState }) {
  const locale = useLocale();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-4">
      <h2 id={headingId}>{t('mappe.wordCountHeading', locale)}</h2>
      <div role="status">
        <CountText state={state} locale={locale} />
      </div>
    </section>
  );
}

const STATE_TEXT: Readonly<Record<Exclude<MappePreviewState['kind'], 'counted'>, MessageKey>> = {
  none: 'mappe.wordCountChoose',
  counting: 'mappe.wordCountCounting',
  failed: 'mappe.wordCountFailed',
};

function CountText({ state, locale }: { readonly state: MappePreviewState; readonly locale: Locale }) {
  if (state.kind !== 'counted') return <p className="m-0">{t(STATE_TEXT[state.kind], locale)}</p>;
  const { preview } = state;
  const over = preview.overLimit;
  const number = new Intl.NumberFormat([...INTL_LOCALE[locale]]);
  return (
    <p
      className={`m-0 border-l-4 p-2 ${
        over ? 'border-hvl-feedback-incorrect-border' : 'border-hvl-feedback-correct-border'
      }`}
    >
      <span aria-hidden="true">{over ? SEVERITY_ICON.warning : WITHIN_ICON} </span>
      {t(over ? 'mappe.wordCountOver' : 'mappe.wordCountWithin', locale, {
        words: number.format(preview.words),
        wordLimit: number.format(preview.wordLimit),
        attachments: preview.attachments,
        attachmentLimit: preview.attachmentLimit,
      })}
    </p>
  );
}
