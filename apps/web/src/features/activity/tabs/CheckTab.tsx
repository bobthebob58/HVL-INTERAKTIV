/**
 * CheckTab — the **Sjekk og publiser** tab of the activity page: the validator's findings and the publish gate.
 *
 * Why: PROD-003's check-and-publish gate lives on the activity's own page. «Gå til feltet» opens the **Rediger** tab
 *      at the field, and a change of status loads the activity again, so the heading's status badge follows. The
 *      first-publish dialog says when the learning design lacks a phase or outcomes, with a link to the
 *      **Læringsdesign** tab, and never blocks publishing (D-087). A published *Etterarbeid* activity gets the
 *      repetition suggestion under the panel, and the status after its first publish says so (PROD-014, D-152).
 * Spec: PROD-003, UD-022, PED-030, PROD-014
 * Invariants:
 *   - Shown only to people who may publish (`mayPublish`, ./activityTabs.ts); the server checks again.
 *   - The prompt's link closes the dialog, opens the **Læringsdesign** tab and moves focus to its heading.
 *   - `focusCheckHeading` moves focus to this tab's heading when another tab opens it (UD-006, WCAG 2.4.3).
 *   - The repetition suggestion shows only while the activity is published and its stored phase is the one the
 *     suggestion is for; when the phase is known at a first publish, one status message says both that the
 *     activity is published and where the suggestion is.
 * Collaborators: ./activityTab.ts, ./activityTabs.ts, ../CheckPanel.tsx, ./LearningDesignTab.tsx, ./InsightTab.tsx,
 *   ../../learningDesign/LearningDesignPrompt.tsx, ../../learningDesign/LearningDesignPanel.tsx,
 *   ../../learningDesign/RepetitionSuggestion.tsx, ../../learningDesign/useActivityPhase.ts.
 * Tests: apps/web/test/features/ActivityView.test.tsx, apps/web/test/features/CheckPanel.test.tsx,
 *   apps/web/test/features/LearningDesignPrompt.test.tsx, apps/web/test/features/insight/InsightTabs.test.tsx,
 *   apps/web/test/features/CheckTabRepetition.test.tsx
 */
'use client';

import { focusLearningDesignHeading } from '../../learningDesign/LearningDesignPanel';
import { LearningDesignPrompt } from '../../learningDesign/LearningDesignPrompt';
import { REPETITION_PHASE } from '../../learningDesign/repetitionDates';
import { RepetitionSuggestion } from '../../learningDesign/RepetitionSuggestion';
import { useActivityPhase } from '../../learningDesign/useActivityPhase';
import { CHECK_HEADING_ID, CheckPanel } from '../CheckPanel';
import type { MessageKey } from '../../../i18n/translate';
import type { ActivityTabProps } from './activityTab';
import { LEARNING_DESIGN_TAB_ID } from './LearningDesignTab';

/** The **Sjekk og publiser** tab's `id`. */
export const CHECK_TAB_ID = 'check';

/** Moves focus to the tab's heading once the current render is on screen. */
export const focusCheckHeading = (): void => {
  // WHY: the tab panel is shown (and its heading mounted) by the render this call is part of.
  window.setTimeout(() => document.getElementById(CHECK_HEADING_ID)?.focus(), 0);
};

/**
 * The check-and-publish panel.
 * @param props - The activity, the save revision and the page's handlers.
 * @returns The check panel.
 */
export function CheckTab({
  detail,
  revision,
  goToField,
  reloadDetail,
  selectTab,
  announce,
}: ActivityTabProps) {
  const repetition = useActivityPhase(detail) === REPETITION_PHASE;
  // A11Y: one status message for both, so a screen-reader user hears that the suggestion has appeared.
  const publishedKey: MessageKey = repetition ? 'repetition.published' : 'publish.published';
  const openLearningDesign = (closeDialog: () => void) => {
    closeDialog();
    selectTab(LEARNING_DESIGN_TAB_ID);
    focusLearningDesignHeading();
  };
  return (
    <>
      <CheckPanel
        detail={detail}
        revision={revision}
        onGoToField={goToField}
        onStatusChange={reloadDetail}
        publishedKey={publishedKey}
        publishNotice={(closeDialog) => (
          <LearningDesignPrompt
            contentId={detail.id}
            tabId={LEARNING_DESIGN_TAB_ID}
            onOpen={() => openLearningDesign(closeDialog)}
          />
        )}
      />
      {repetition && detail.status === 'published' && detail.publishedAt ? (
        <RepetitionSuggestion contentId={detail.id} publishedAt={detail.publishedAt} announce={announce} />
      ) : null}
    </>
  );
}
