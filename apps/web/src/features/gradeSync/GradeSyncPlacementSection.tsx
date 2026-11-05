/**
 * GradeSyncPlacementSection — one placement of the activity on the grade-sync panel: its course and Canvas as a
 * heading, its score rule, its counts, and the button that sends its failed scores again, with what that did.
 *
 * Why: LTI-012's acceptance lets authors see the sync status and retry failed jobs per placement (D-104). A link
 *      without a gradebook column sends nothing, which the section says instead of showing counts that can never move.
 * Spec: LTI-012, UD-003, UD-006
 * Invariants:
 *   - A11Y: a section named by its `h3` (WCAG 1.3.1, 2.4.6); the heading takes focus (tabIndex -1) when the retry
 *     button it replaced is gone, so focus never falls to the page (WCAG 2.4.3).
 *   - The button shows only while there are failed scores. While any retry in the panel runs, every retry button is
 *     `aria-disabled`, keeps focus and ignores presses (one request at a time); only this placement's says «Sender …».
 *   - A11Y: the button's name ends with the placement's heading in brackets, visually hidden, so two placements' retry
 *     buttons can be told apart out of context, such as in a screen reader's list of buttons (WCAG 2.4.6, 4.1.2); the
 *     visible label starts the name (WCAG 2.5.3), as ../insight/ShortlistButton.tsx does.
 *   - Feedback is words with ✓ or ✗ (UD-003): a problem is an alert, mounted anew for each refusal so a repeated one
 *     is read again; an outcome is plain text, because the panel's status region announces it.
 * Collaborators: ./GradeSyncPanel.tsx, ./GradeSyncCounts.tsx, ./gradeSyncTexts.ts, ./gradeSyncIcons.ts.
 * Tests: apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx,
 *   apps/web/test/features/gradeSync/GradeSyncPanelRetry.test.tsx
 */
'use client';

import type { GradeSyncPlacement } from '@hvl-interaktiv/api-contract';
import { useId, type Ref } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { GradeSyncCounts } from './GradeSyncCounts';
import { GRADE_SYNC_ICONS } from './gradeSyncIcons';
import { policyText } from './gradeSyncTexts';

/** What a retry left to show: its outcome, or a problem (numbered, so each refusal is a new alert). */
export type GradeSyncFeedback =
  | { readonly kind: 'done'; readonly text: string }
  | { readonly kind: 'problem'; readonly text: string; readonly number: number };

/** What the section needs. */
export interface GradeSyncPlacementSectionProps {
  readonly placement: GradeSyncPlacement;
  /** The heading, unique in the panel (`placementHeading`). */
  readonly heading: string;
  /** Receives the heading element, so the panel can focus it. */
  readonly headingRef: Ref<HTMLHeadingElement>;
  /** This placement's retry is on its way. */
  readonly busy: boolean;
  /**
   * Some retry in the panel is on its way, this one or another placement's. WHY: the panel sends one retry at a time,
   * so a button that would ignore a press says so (`aria-disabled`) instead of doing nothing silently.
   */
  readonly locked: boolean;
  readonly feedback: GradeSyncFeedback | undefined;
  /** Sends the failed scores again. */
  readonly onRetry: () => void;
}

/**
 * One placement's grade sync.
 * @param props - The placement, its heading, whether its retry runs, its feedback and the retry action.
 * @returns The section.
 */
export function GradeSyncPlacementSection({
  placement,
  heading,
  headingRef,
  busy,
  locked,
  feedback,
  onRetry,
}: GradeSyncPlacementSectionProps) {
  const locale = useLocale();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h3 id={headingId} ref={headingRef} tabIndex={-1}>
        {heading}
      </h3>
      {placement.graded ? (
        <>
          <p>
            <span className="font-bold">{t('gradeSync.policyLabel', locale)}</span>{' '}
            {policyText(placement, locale)}
          </p>
          <GradeSyncCounts counts={placement.counts} />
        </>
      ) : (
        <p>{t('gradeSync.notGraded', locale)}</p>
      )}
      {placement.counts.failed > 0 ? (
        <button
          type="button"
          className="button-primary mt-3"
          aria-disabled={locked || undefined}
          onClick={() => {
            if (!locked) onRetry();
          }}
        >
          {busy ? t('gradeSync.retrying', locale) : t('gradeSync.retry', locale)}
          {/* WHY: brackets, not a colon: a browser puts a space before the visually hidden part. */}
          <span className="sr-only"> ({heading})</span>
        </button>
      ) : null}
      {feedback?.kind === 'done' ? (
        <p className="mb-0 mt-2">
          <span aria-hidden="true">{GRADE_SYNC_ICONS.done} </span>
          {feedback.text}
        </p>
      ) : null}
      {feedback?.kind === 'problem' ? (
        <p key={feedback.number} role="alert" className="mb-0 mt-2 font-bold text-hvl-feedback-incorrect-fg">
          <span aria-hidden="true">{GRADE_SYNC_ICONS.problem} </span>
          {feedback.text}
        </p>
      ) : null}
    </section>
  );
}
