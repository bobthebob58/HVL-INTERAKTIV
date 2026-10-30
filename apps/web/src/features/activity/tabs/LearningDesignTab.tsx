/**
 * LearningDesignTab — the **Læringsdesign** tab of the activity page: the activity's learning-design metadata.
 *
 * Why: PED-030 tags each activity with phase, course code, outcomes, rationale, student minutes and (D-087) the
 *      learner purpose; D-089 puts them on their own tab for people who may edit the activity.
 * Spec: PED-030, UD-006
 * Invariants:
 *   - Shown only to people who may edit (`forEditors`, ./activityTabs.ts); the server checks Edit again on every
 *     request and never gives viewers or learners the metadata (D-087).
 * Collaborators: ./activityTab.ts, ./activityTabs.ts, ../../learningDesign/LearningDesignPanel.tsx.
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx, apps/web/test/features/activityTabs.test.tsx
 */
'use client';

import { LearningDesignPanel } from '../../learningDesign/LearningDesignPanel';
import type { ActivityTabProps } from './activityTab';

/** The **Læringsdesign** tab's `id` (`?fane=learning-design`). */
export const LEARNING_DESIGN_TAB_ID = 'learning-design';

/**
 * The learning-design panel.
 * @param props - The activity, the announcer and the reload handler.
 * @returns The panel.
 */
export function LearningDesignTab({ detail, announce, reloadDetail }: ActivityTabProps) {
  return <LearningDesignPanel detail={detail} announce={announce} reloadDetail={reloadDetail} />;
}
