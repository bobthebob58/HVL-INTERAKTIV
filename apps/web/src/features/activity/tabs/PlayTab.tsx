/**
 * PlayTab — the **Spel** tab of the activity page: the estimated time and purpose, then the activity in H5P's
 * player, framed from Express.
 *
 * Why: everyone who may view an activity can try it as learners see it (LTI-006, PROD-003), including what learners
 *      see before they start (PED-032). The player reloads after each save in the editor (`revision`), so the author
 *      sees the saved version.
 * Spec: LTI-006, PROD-003, UD-006, PED-032
 * Invariants:
 *   - The frame has a title that names the activity (WCAG 4.1.2).
 *   - The time and purpose come from the activity summary the server answered after the View check (D-087), and
 *     come before the frame.
 * Collaborators: ./activityTab.ts, ./activityTabs.ts, ../../../components/H5pFrame.tsx,
 *   ../../../components/LearnerInfo.tsx, ../../../config/paths.ts.
 * Tests: apps/web/test/features/ActivityView.test.tsx, apps/web/test/features/learnerInfoViews.test.tsx
 */
'use client';

import { H5pFrame } from '../../../components/H5pFrame';
import { LearnerInfo } from '../../../components/LearnerInfo';
import { playerPath } from '../../../config/paths';
import { useLocale } from '../../../i18n/LocaleContext';
import { t } from '../../../i18n/translate';
import type { ActivityTabProps } from './activityTab';

/** The **Spel** tab's `id`. */
export const PLAY_TAB_ID = 'play';

/**
 * The player panel.
 * @param props - The activity, the save revision and the frames.
 * @returns The learner info and the titled player frame.
 */
export function PlayTab({ detail, revision, frames }: ActivityTabProps) {
  const locale = useLocale();
  const { estimatedStudentMinutes, learnerPurpose, language } = detail;
  return (
    <>
      <LearnerInfo
        estimatedStudentMinutes={estimatedStudentMinutes}
        learnerPurpose={learnerPurpose}
        language={language}
      />
      <H5pFrame
        key={revision}
        src={playerPath(detail.id)}
        title={t('activity.playFrame', locale, { title: detail.title })}
        frameRef={frames.playerRef}
      />
    </>
  );
}
