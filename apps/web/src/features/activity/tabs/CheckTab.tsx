/**
 * CheckTab — the **Sjekk og publiser** tab of the activity page: the validator's findings and the publish gate.
 *
 * Why: PROD-003's check-and-publish gate lives on the activity's own page. «Gå til feltet» opens the **Rediger** tab
 *      at the field, and a change of status loads the activity again, so the heading's status badge follows. The
 *      first-publish dialog says when the learning design lacks a phase or outcomes, with a link to the
 *      **Læringsdesign** tab, and never blocks publishing (D-087).
 * Spec: PROD-003, UD-022, PED-030
 * Invariants:
 *   - Shown only to people who may publish (`mayPublish`, ./activityTabs.ts); the server checks again.
 *   - The prompt's link closes the dialog, opens the **Læringsdesign** tab and moves focus to its heading.
 * Collaborators: ./activityTab.ts, ./activityTabs.ts, ../CheckPanel.tsx, ./LearningDesignTab.tsx,
 *   ../../learningDesign/LearningDesignPrompt.tsx, ../../learningDesign/LearningDesignPanel.tsx.
 * Tests: apps/web/test/features/ActivityView.test.tsx, apps/web/test/features/CheckPanel.test.tsx,
 *   apps/web/test/features/LearningDesignPrompt.test.tsx
 */
'use client';

import { focusLearningDesignHeading } from '../../learningDesign/LearningDesignPanel';
import { LearningDesignPrompt } from '../../learningDesign/LearningDesignPrompt';
import { CheckPanel } from '../CheckPanel';
import type { ActivityTabProps } from './activityTab';
import { LEARNING_DESIGN_TAB_ID } from './LearningDesignTab';

/** The **Sjekk og publiser** tab's `id`. */
export const CHECK_TAB_ID = 'check';

/**
 * The check-and-publish panel.
 * @param props - The activity, the save revision and the page's handlers.
 * @returns The check panel.
 */
export function CheckTab({ detail, revision, goToField, reloadDetail, selectTab }: ActivityTabProps) {
  const openLearningDesign = (closeDialog: () => void) => {
    closeDialog();
    selectTab(LEARNING_DESIGN_TAB_ID);
    focusLearningDesignHeading();
  };
  return (
    <CheckPanel
      detail={detail}
      revision={revision}
      onGoToField={goToField}
      onStatusChange={reloadDetail}
      publishNotice={(closeDialog) => (
        <LearningDesignPrompt
          contentId={detail.id}
          tabId={LEARNING_DESIGN_TAB_ID}
          onOpen={() => openLearningDesign(closeDialog)}
        />
      )}
    />
  );
}
