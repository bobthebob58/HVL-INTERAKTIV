/**
 * CheckTab — the **Sjekk og publiser** tab of the activity page: the validator's findings and the publish gate.
 *
 * Why: PROD-003's check-and-publish gate lives on the activity's own page. «Gå til feltet» opens the **Rediger** tab
 *      at the field, and a change of status loads the activity again, so the heading's status badge follows.
 * Spec: PROD-003, UD-022
 * Invariants:
 *   - Shown only to people who may publish (`mayPublish`, ./activityTabs.ts); the server checks again.
 * Collaborators: ./activityTab.ts, ./activityTabs.ts, ../CheckPanel.tsx.
 * Tests: apps/web/test/features/ActivityView.test.tsx, apps/web/test/features/CheckPanel.test.tsx
 */
'use client';

import { CheckPanel } from '../CheckPanel';
import type { ActivityTabProps } from './activityTab';

/** The **Sjekk og publiser** tab's `id`. */
export const CHECK_TAB_ID = 'check';

/**
 * The check-and-publish panel.
 * @param props - The activity, the save revision and the page's handlers.
 * @returns The check panel.
 */
export function CheckTab({ detail, revision, goToField, reloadDetail }: ActivityTabProps) {
  return (
    <CheckPanel detail={detail} revision={revision} onGoToField={goToField} onStatusChange={reloadDetail} />
  );
}
