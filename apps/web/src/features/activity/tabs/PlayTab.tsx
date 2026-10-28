/**
 * PlayTab — the **Spel** tab of the activity page: the activity in H5P's player, framed from Express.
 *
 * Why: everyone who may view an activity can try it as learners see it (LTI-006, PROD-003). The player reloads after
 *      each save in the editor (`revision`), so the author sees the saved version.
 * Spec: LTI-006, PROD-003, UD-006
 * Invariants:
 *   - The frame has a title that names the activity (WCAG 4.1.2).
 * Collaborators: ./activityTab.ts, ./activityTabs.ts, ../../../components/H5pFrame.tsx, ../../../config/paths.ts.
 * Tests: apps/web/test/features/ActivityView.test.tsx
 */
'use client';

import { H5pFrame } from '../../../components/H5pFrame';
import { playerPath } from '../../../config/paths';
import { useLocale } from '../../../i18n/LocaleContext';
import { t } from '../../../i18n/translate';
import type { ActivityTabProps } from './activityTab';

/** The **Spel** tab's `id`. */
export const PLAY_TAB_ID = 'play';

/**
 * The player panel.
 * @param props - The activity, the save revision and the frames.
 * @returns The titled player frame.
 */
export function PlayTab({ detail, revision, frames }: ActivityTabProps) {
  const locale = useLocale();
  return (
    <H5pFrame
      key={revision}
      src={playerPath(detail.id)}
      title={t('activity.playFrame', locale, { title: detail.title })}
      frameRef={frames.playerRef}
    />
  );
}
