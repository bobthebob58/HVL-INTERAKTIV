/**
 * PlannerUntagged — the activities with the planner's course code that lack a phase, learning outcomes or both,
 * listed below the table with what each lacks and a link to it.
 *
 * Why: D-088 lists untagged activities instead of hiding them, so the author sees what to fill in on each one's
 *      **Læringsdesign** tab before the plan is complete.
 * Spec: PED-031, UD-003
 * Invariants:
 *   - Nothing is shown when every activity is in the table.
 *   - Status is said in text with its icon (`StatusBadge`); a title carries its own language (UD-010).
 * Collaborators: ./PlannerWorkspace.tsx, ../../components/StatusBadge.tsx, ../../config/paths.ts.
 * Tests: apps/web/test/features/PlannerTable.test.tsx
 */
'use client';

import type { PlannerUntagged as UntaggedActivity } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { activityPath } from '../../config/paths';
import { useLocale } from '../../i18n/LocaleContext';
import { partLanguage } from '../../i18n/partLanguage';
import { t, type MessageKey } from '../../i18n/translate';

const missingText = (missing: UntaggedActivity['missing']): MessageKey =>
  missing.length > 1
    ? 'planner.missingBoth'
    : missing[0] === 'phase'
      ? 'planner.missingPhase'
      : 'planner.missingOutcomes';

/** What the list needs. */
export interface PlannerUntaggedProps {
  readonly courseCode: string;
  readonly untagged: readonly UntaggedActivity[];
}

/**
 * The untagged activities.
 * @param props - The course code and the activities.
 * @returns A section with a heading and one item per activity, or nothing.
 */
export function PlannerUntagged({ courseCode, untagged }: PlannerUntaggedProps) {
  const locale = useLocale();
  const headingId = useId();
  if (untagged.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h2 id={headingId}>{t('planner.untaggedHeading', locale)}</h2>
      <p>{t('planner.untaggedIntro', locale, { course: courseCode })}</p>
      <ul className="m-0 list-none p-0">
        {untagged.map((activity) => (
          <li key={activity.contentId} className="mb-1">
            <a href={activityPath(activity.contentId)} lang={partLanguage(activity.language, locale)}>
              {activity.title}
            </a>{' '}
            {t(missingText(activity.missing), locale)}{' '}
            <StatusBadge status={activity.status} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}
