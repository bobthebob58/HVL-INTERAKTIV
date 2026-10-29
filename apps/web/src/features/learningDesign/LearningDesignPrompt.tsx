/**
 * LearningDesignPrompt — the publish dialog's reminder that the activity's learning design lacks a phase or
 * learning outcomes, with a link to the **Læringsdesign** tab. It never blocks publishing.
 *
 * Why: PED-030 makes the metadata optional in draft and "prompted (but not required) on publish"; D-087 shows the
 *      prompt in the publish dialog. The planner and the portfolio need the phase and the outcomes, so the dialog
 *      says what is missing; the author may still publish at once.
 * Spec: PED-030, UD-003
 * Invariants:
 *   - It takes no part in the publish request: nothing here can disable, delay or refuse publishing, and a failed
 *     read of the metadata shows nothing.
 *   - The message is in a status region that exists before it is filled, so it is announced when it arrives; it has
 *     an icon and a text, never colour alone.
 *   - The link works as a link to `?fane=learning-design`; a click instead closes the dialog, opens the tab and moves
 *     focus to its heading (WCAG 2.4.3), keeping what the dialog held.
 * Collaborators: ../activity/tabs/CheckTab.tsx (gives it to the dialog), ../../components/PublishDialog.tsx,
 *   ./LearningDesignPanel.tsx (`focusLearningDesignHeading`), ../../api/learningDesignApi.ts.
 * Tests: apps/web/test/features/LearningDesignPrompt.test.tsx
 */
'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getLearningDesign } from '../../api/learningDesignApi';
import { INFO_ICON } from '../../components/Notice';
import { activityPath } from '../../config/paths';
import { useLocale } from '../../i18n/LocaleContext';
import { t, type MessageKey } from '../../i18n/translate';

/** What is missing from the learning design. */
type Missing = 'phase' | 'outcomes' | 'both';

const MESSAGE: Readonly<Record<Missing, MessageKey>> = {
  phase: 'learningDesign.promptPhase',
  outcomes: 'learningDesign.promptOutcomes',
  both: 'learningDesign.promptBoth',
};

/** What the prompt needs. */
export interface LearningDesignPromptProps {
  readonly contentId: string;
  /** The **Læringsdesign** tab's `id`, for the link's address. */
  readonly tabId: string;
  /** Closes the dialog and opens the tab. */
  readonly onOpen: () => void;
}

/**
 * The prompt.
 * @param props - The activity, the tab's `id` and what a click on the link does.
 * @returns A status region with the prompt when a phase or outcomes are missing.
 */
export function LearningDesignPrompt({ contentId, tabId, onOpen }: LearningDesignPromptProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [missing, setMissing] = useState<Missing>();
  useEffect(() => {
    let active = true;
    void getLearningDesign(contentId, auth).then((result) => {
      if (!active || !result.ok) return;
      const phase = result.data.phase === undefined;
      const outcomes = result.data.outcomes.length === 0;
      setMissing(phase && outcomes ? 'both' : phase ? 'phase' : outcomes ? 'outcomes' : undefined);
    });
    return () => {
      active = false;
    };
  }, [contentId, auth]);

  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onOpen();
  };
  return (
    <div role="status">
      {missing ? (
        <div className="mb-4 border-l-4 border-hvl-primary-dark bg-hvl-feedback-info-bg p-3 text-hvl-feedback-info-fg">
          <p className="m-0 font-bold">
            <span aria-hidden="true">{INFO_ICON} </span>
            {t(MESSAGE[missing], locale)}
          </p>
          <p className="m-0">{t('learningDesign.promptNote', locale)}</p>
          <a href={activityPath(contentId, tabId)} onClick={open}>
            {t('learningDesign.promptLink', locale)}
          </a>
        </div>
      ) : null}
    </div>
  );
}
