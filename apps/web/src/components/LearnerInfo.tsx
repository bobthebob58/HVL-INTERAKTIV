/**
 * LearnerInfo — what learners see before an activity starts: the estimated time and one line on why the activity
 * matters, from its learning design.
 *
 * Why: PED-032 lets students plan their study and self-regulate. D-087 gives learners exactly these two fields, after
 *      the View check: the portal's **Spel** tab reads them from the activity summary, the Canvas page from the
 *      launch Express resolved (`x-hvli-launch`).
 * Spec: PED-032, UD-010
 * Invariants:
 *   - Nothing is shown when neither is set; the rationale, the course code and the outcomes are never passed here.
 *   - The purpose carries the activity's own language when it differs from the page's (`lang`, WCAG 3.1.2); the
 *     labels are in the page's language.
 *   - A description list in a labelled section, before the activity, so a screen reader reads it first.
 * Collaborators: ../features/activity/tabs/PlayTab.tsx, ../features/lti/LtiPlayView.tsx, ../i18n/partLanguage.ts.
 * Tests: apps/web/test/features/learnerInfoViews.test.tsx
 */
'use client';

import type { LearnerInfo as LearnerInfoFields } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { useLocale } from '../i18n/LocaleContext';
import { partLanguage } from '../i18n/partLanguage';
import { t } from '../i18n/translate';

/**
 * The estimated time and the purpose, before the activity.
 * @param props - The minutes, the purpose and the activity's own language tag; each may be absent.
 * @returns The labelled section, or nothing when neither is set.
 */
export function LearnerInfo({ estimatedStudentMinutes, learnerPurpose, language }: LearnerInfoFields) {
  const locale = useLocale();
  const headingId = useId();
  if (estimatedStudentMinutes === undefined && !learnerPurpose) return null;
  const minutes =
    estimatedStudentMinutes === 1
      ? t('learningDesign.infoMinutesOne', locale)
      : t('learningDesign.infoMinutesOther', locale, { minutes: estimatedStudentMinutes ?? 0 });
  return (
    <section
      aria-labelledby={headingId}
      className="mb-4 border-l-4 border-hvl-primary-dark bg-hvl-surface-alt p-3"
    >
      <h2 id={headingId} className="m-0 text-lg">
        {t('learningDesign.infoLabel', locale)}
      </h2>
      <dl className="m-0">
        {estimatedStudentMinutes !== undefined ? (
          <div className="mt-2">
            <dt className="font-bold">{t('learningDesign.infoTime', locale)}</dt>
            <dd className="m-0">{minutes}</dd>
          </div>
        ) : null}
        {learnerPurpose ? (
          <div className="mt-2">
            <dt className="font-bold">{t('learningDesign.infoPurpose', locale)}</dt>
            <dd className="m-0" lang={partLanguage(language, locale)}>
              {learnerPurpose}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
