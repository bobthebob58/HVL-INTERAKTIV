/**
 * GradeSyncTab — the activity page's **Poeng til Canvas** tab (`?fane=grade-sync`): the scores sent to the Canvas
 * gradebook from each course the activity is placed in, for its owner and co-authors.
 *
 * Why: LTI-012's acceptance has authors see a per-activity sync status and retry failed jobs on the activity page
 *      (D-104). Who sees it follows D-106: the activity's owner and co-authors, not an admin through the role, so the
 *      tab shows for a `role` of owner or co-author, not for `mayEdit`, which admins also have.
 * Spec: LTI-012, LTI-013, UD-006
 * Invariants:
 *   - Shown only when the server says the person owns or co-authors the activity; the server checks every request
 *     again (../../gradeSync/gradeSyncApi.ts).
 * Collaborators: ./activityTabs.ts, ./activityTab.ts, ../../gradeSync/GradeSyncPanel.tsx.
 * Tests: apps/web/test/features/activityTabs.test.tsx, apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx
 */
'use client';

import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { GradeSyncPanel } from '../../gradeSync/GradeSyncPanel';
import type { ActivityTabProps } from './activityTab';

/** The **Poeng til Canvas** tab's `id` (`?fane=grade-sync`). */
export const GRADE_SYNC_TAB_ID = 'grade-sync';

/**
 * A tab for the activity's owner and co-authors (D-106): admins and colleagues who may only view do not get it.
 * @param detail - The server's answer.
 * @returns True when `role` is owner or co-author.
 */
export const forOwnersAndCoAuthors = (detail: ContentDetail): boolean => detail.role !== null;

/**
 * The **Poeng til Canvas** tab's panel.
 * @param props - The page's shared tab props; this tab uses the activity's ID.
 * @returns The panel.
 */
export function GradeSyncTab({ detail }: ActivityTabProps) {
  return <GradeSyncPanel contentId={detail.id} />;
}
