/**
 * GradeSyncCounts — one placement's scores counted by state: sent, waiting, failed and «assignment deleted», each
 * with an icon and words, and a line on what the failed and deleted ones mean.
 *
 * Why: LTI-012's acceptance shows authors the counts sent, pending and failed, and D-104 adds orphaned. CLAUDE.md §1
 *      and UD-003 never let a state rest on colour: each count is named in words, with an icon that repeats it, and a
 *      coloured edge is only a third cue.
 * Spec: LTI-012, UD-003, UD-006
 * Invariants:
 *   - A11Y: a description list, so each number is read with its name (WCAG 1.3.1); the icons are `aria-hidden`.
 *   - The order is fixed: sent, pending, failed, orphaned; a count of 0 is shown as 0, never hidden.
 *   - Colours come from the design tokens only (D-017): the feedback edges for sent and for failed or deleted scores
 *     when there are any, the band colour otherwise.
 * Collaborators: ./GradeSyncPlacementSection.tsx, ./gradeSyncIcons.ts, ../../i18n/translate.ts.
 * Tests: apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx
 */
'use client';

import type { GradeSyncCounts as Counts } from '@hvl-interaktiv/api-contract';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { GRADE_SYNC_ICONS } from './gradeSyncIcons';

/** The states in the order shown. */
const STATES = ['sent', 'pending', 'failed', 'orphaned'] as const;

/**
 * The coloured edge of one count: a third cue beside the icon and the words.
 * @param state - The state.
 * @param count - Its count.
 * @returns The Tailwind border class.
 */
const edgeOf = (state: (typeof STATES)[number], count: number): string => {
  if (count > 0 && state === 'sent') return 'border-hvl-feedback-correct-border';
  if (count > 0 && (state === 'failed' || state === 'orphaned'))
    return 'border-hvl-feedback-incorrect-border';
  return 'border-hvl-band';
};

/**
 * The counts of one placement.
 * @param props - The counts.
 * @returns The list, and a line each for failed and deleted scores when there are any.
 */
export function GradeSyncCounts({ counts }: { readonly counts: Counts }) {
  const locale = useLocale();
  return (
    <>
      <dl className="m-0 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {STATES.map((state) => (
          <div key={state} className={`border-l-4 bg-hvl-surface p-3 ${edgeOf(state, counts[state])}`}>
            <dt>
              <span aria-hidden="true">{GRADE_SYNC_ICONS[state]} </span>
              {t(`gradeSync.${state}`, locale)}
            </dt>
            <dd className="m-0 text-2xl font-bold">{counts[state]}</dd>
          </div>
        ))}
      </dl>
      {counts.failed > 0 ? <p className="mb-0 mt-2">{t('gradeSync.failedHint', locale)}</p> : null}
      {counts.orphaned > 0 ? <p className="mb-0 mt-2">{t('gradeSync.orphanedHint', locale)}</p> : null}
    </>
  );
}
