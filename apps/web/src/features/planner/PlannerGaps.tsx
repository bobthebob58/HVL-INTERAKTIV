/**
 * PlannerGaps — the planner's list of gaps: each learning outcome without an etterarbeid activity, and each phase
 * without any activity.
 *
 * Why: PED-031 highlights gaps such as "an outcome with no etterarbeid activity or a phase with no activities"; D-088
 *      shows each gap with an icon and a text, never by colour alone (UD-003, WCAG 1.4.1). A list under its own
 *      heading gives the gaps at a glance before the table.
 * Spec: PED-031, UD-003
 * Invariants:
 *   - Phase names are the content's labels (PED-001); the outcome is quoted in the author's words.
 *   - With no gaps the section says so, so the heading is never followed by nothing.
 * Collaborators: ./PlannerWorkspace.tsx, ../../components/FindingsList.tsx (`SEVERITY_ICON`).
 * Tests: apps/web/test/features/PlannerTable.test.tsx
 */
'use client';

import type { PhaseKey, PlannerGap } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { SEVERITY_ICON } from '../../components/FindingsList';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** The phase whose absence for an outcome is a gap (D-088). */
const CONSOLIDATION_PHASE: PhaseKey = 'etterarbeid';

/** What the list needs. */
export interface PlannerGapsProps {
  readonly gaps: readonly PlannerGap[];
  /** Each phase's label from content, in the page's language. */
  readonly phaseLabel: (phase: PhaseKey) => string;
}

/**
 * The gap list.
 * @param props - The gaps and the phase labels.
 * @returns A section with a heading and one item per gap.
 */
export function PlannerGaps({ gaps, phaseLabel }: PlannerGapsProps) {
  const locale = useLocale();
  const headingId = useId();
  const text = (gap: PlannerGap): string =>
    gap.kind === 'no-etterarbeid'
      ? t('planner.gapNoEtterarbeid', locale, {
          phase: phaseLabel(CONSOLIDATION_PHASE),
          outcome: gap.outcome.text,
        })
      : t('planner.gapEmptyPhase', locale, { phase: phaseLabel(gap.phase) });
  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h2 id={headingId}>{t('planner.gapsHeading', locale)}</h2>
      {gaps.length === 0 ? (
        <p>{t('planner.gapsNone', locale)}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {gaps.map((gap) => (
            <li
              key={
                gap.kind === 'no-etterarbeid'
                  ? `o|${gap.outcome.category}|${gap.outcome.text}`
                  : `p|${gap.phase}`
              }
            >
              <span aria-hidden="true">{SEVERITY_ICON.warning} </span>
              {text(gap)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
