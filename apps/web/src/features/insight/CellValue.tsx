/**
 * CellValue — one insight value as text: the number, «< k» for a suppressed value with a hidden explanation for
 * screen readers, or «Ikkje tilgjengeleg» for a value the activity type cannot send.
 *
 * Why: INS-006 shows a value about fewer than k learners as «< 5» and never as a number (D-106); a screen reader would
 *      read «< 5» as "less than 5" with no reason given, so a visually hidden phrase says that the value is hidden
 *      for privacy. The phrase does not repeat "fewer than k": a cell hidden so that another cannot be worked out
 *      from a total (INS-006's next-smallest cell) can hold k or more, and nothing in the answer tells the two apart
 *      (the privacy note says so). D-115 tells "not available" (null) apart from "suppressed", and from 0, in words.
 * Spec: INS-006, INS-008, INS-001
 * Invariants:
 *   - A suppressed cell renders only «< k» and the hidden phrase; it has no value to render (packages/api-contract).
 *   - The visible text is the same as ./insightFormat.ts `cellText`, so tables, tiles and summaries agree.
 * Collaborators: ./insightFormat.ts, ./ParticipationSection.tsx, the tables in this folder.
 * Tests: apps/web/test/features/insight/InsightCharts.test.tsx
 */
'use client';

import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { cellText, type AnyCell, type ValueKind } from './insightFormat';

/** What a value needs. */
export interface CellValueProps {
  /** The cell, or null when the type cannot send the value (D-115). */
  readonly cell: AnyCell | null;
  readonly kind: ValueKind;
  /** The minimum group size of the view. */
  readonly k: number;
}

/**
 * One value as text.
 * @param props - The cell, how it is written and k.
 * @returns The text, with a hidden explanation when it is suppressed.
 */
export function CellValue({ cell, kind, k }: CellValueProps) {
  const locale = useLocale();
  const text = cellText(cell, kind, k, locale);
  if (cell === null || !cell.suppressed) return <>{text}</>;
  return (
    <>
      {text}
      {/* A11Y: «< 5» alone is read as "less than 5"; the reason is said too (INS-006). */}
      <span className="sr-only"> ({t('insight.suppressedSr', locale)})</span>
    </>
  );
}
