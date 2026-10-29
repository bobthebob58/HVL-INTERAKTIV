/**
 * SharingTab — the activity page's **Deling** tab (`?fane=sharing`): visibility, co-authors, the content bank and
 * «Lag ein kopi», for people who may edit the activity.
 *
 * Why: D-089 adds **Deling** to `/aktivitet/[id]`; the registry (./activityTabs.ts) lists it after **Læringsdesign**,
 *      so the tab is this file and one registry line (PROD-007).
 * Spec: PROD-007, PROD-006, UD-006
 * Invariants:
 *   - Shown only to people who may edit (`forEditors`); the server checks every request again.
 * Collaborators: ./activityTabs.ts, ./activityTab.ts, ../../sharing/SharingPanel.tsx.
 * Tests: apps/web/test/features/activityTabs.test.tsx, apps/web/test/features/SharingPanel.test.tsx
 */
'use client';

import { SharingPanel } from '../../sharing/SharingPanel';
import type { ActivityTabProps } from './activityTab';

/** The **Deling** tab's `id` (`?fane=sharing`). */
export const SHARING_TAB_ID = 'sharing';

/**
 * The **Deling** tab's panel.
 * @param props - The page's shared tab props; this tab uses the activity, the announcer and the reload.
 * @returns The panel.
 */
export function SharingTab({ detail, announce, reloadDetail }: ActivityTabProps) {
  return <SharingPanel detail={detail} announce={announce} reloadDetail={reloadDetail} />;
}
