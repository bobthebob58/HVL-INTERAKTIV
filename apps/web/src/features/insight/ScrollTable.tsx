/**
 * ScrollTable — the visible data table of an insight chart: a `<table>` with a `<caption>`, in a named region that
 * scrolls sideways on a narrow screen and can be reached with the keyboard to scroll it.
 *
 * Why: INS-008 gives every chart a visible data table alternative; a table of several columns does not fit 320 px,
 *      so it scrolls inside its own region rather than widening the page (WCAG 1.4.10), and the region takes focus so
 *      keyboard users can scroll it (WCAG 2.1.1), as the planner's table does (../planner/PlannerTable.tsx).
 * Spec: INS-008, UD-008, UD-006
 * Invariants:
 *   - A11Y: the region is named by the table's caption; header cells use `scope` (the callers' `HEAD_CELL` and
 *     `ROW_HEAD_CELL`), so each value is read with its row and column.
 *   - Borders and the header band come from the tokens (D-017).
 * Collaborators: ./ItemDifficultySection.tsx, ./ChoiceQuestion.tsx, ./GapQuestion.tsx,
 *   ./VideoEngagementSection.tsx.
 * Tests: apps/web/test/features/insight/InsightCharts.test.tsx
 */
'use client';

import { useId, type ReactNode } from 'react';

/** The classes of a column header cell (`<th scope="col">`). */
export const HEAD_CELL = 'border border-hvl-ink-muted bg-hvl-band p-2 align-bottom';
/** The classes of a row header cell (`<th scope="row">`). */
export const ROW_HEAD_CELL = 'border border-hvl-ink-muted p-2 align-top font-normal';
/** The classes of a data cell. */
export const DATA_CELL = 'border border-hvl-ink-muted p-2 align-top';

/**
 * A captioned table in a scrolling region.
 * @param props - The caption and the table's head and body.
 * @returns The region with the table.
 */
export function ScrollTable({
  caption,
  children,
}: {
  readonly caption: string;
  readonly children: ReactNode;
}) {
  const captionId = useId();
  return (
    // WHY: `relative` makes the region the containing block of visually hidden texts in its cells, so it clips them.
    <div role="region" aria-labelledby={captionId} tabIndex={0} className="relative mb-4 overflow-x-auto">
      <table className="min-w-xl border-collapse bg-hvl-surface text-left">
        <caption id={captionId} className="mb-2 text-left font-bold">
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}
