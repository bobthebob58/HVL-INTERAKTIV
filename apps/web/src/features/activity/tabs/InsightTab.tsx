/**
 * InsightTab — the activity page's **Innsikt** tab (`?fane=insight`): «Innsikt før samlinga» for the activity's owner
 * and co-authors, one context, version and period at a time, chosen on the tab.
 *
 * Why: PROD-010 and D-101 put teacher insight in a tab of the activity page. Who sees it follows D-106: the activity's
 *      owner and co-authors, not an admin through the role (INS-007's audited support action is not built), so the
 *      tab shows for a `role` of owner or co-author, as **Poeng til Canvas** does, not for `mayEdit`.
 * Spec: PROD-010, INS-007, LTI-006, UD-006, UD-010
 * Invariants:
 *   - Shown only when the server says the person owns or co-authors the activity; the server checks every request
 *     again (../../insight/insightApi.ts).
 *   - «Opne Sjekk og publiser» is offered only to those who get that tab (`mayPublish`); it opens the tab and moves
 *     focus to its heading, since the pressed button is hidden with this panel (UD-006, WCAG 2.4.3).
 *   - The panel gets the activity's language, for the texts it quotes from the activity (UD-010).
 * Collaborators: ./activityTabs.ts, ./activityTab.ts, ./GradeSyncTab.tsx (`forOwnersAndCoAuthors`), ./CheckTab.tsx,
 *   ../../insight/InsightPanel.tsx.
 * Tests: apps/web/test/features/insight/InsightTabs.test.tsx
 */
'use client';

import { InsightPanel } from '../../insight/InsightPanel';
import type { ActivityTabProps } from './activityTab';
import { CHECK_TAB_ID, focusCheckHeading } from './CheckTab';

/** The **Innsikt** tab's `id` (`?fane=insight`). */
export const INSIGHT_TAB_ID = 'insight';

/**
 * The **Innsikt** tab's panel.
 * @param props - The page's shared tab props; this tab uses the activity and the way to another tab.
 * @returns The panel.
 */
export function InsightTab({ detail, selectTab }: ActivityTabProps) {
  const openCheck = () => {
    selectTab(CHECK_TAB_ID);
    focusCheckHeading();
  };
  return (
    <InsightPanel
      contentId={detail.id}
      title={detail.title}
      language={detail.language}
      onOpenCheck={detail.mayPublish ? openCheck : undefined}
    />
  );
}
