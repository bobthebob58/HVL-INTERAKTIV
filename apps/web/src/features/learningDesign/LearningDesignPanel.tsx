/**
 * LearningDesignPanel — the **Læringsdesign** tab's content: its heading, what the tab is for, the pattern the
 * activity came from, and the form for the stored metadata once it has loaded.
 *
 * Why: PED-030 lets authors tag each activity; the planner (PED-031), the portfolio and what learners see before they
 *      start (PED-032) read these tags. The panel loads the stored version and mounts the form once per version, so
 *      loading what is stored after a conflict (D-087) starts a fresh form.
 * Spec: PED-030, PED-032, UD-006
 * Invariants:
 *   - The heading is always shown and takes focus (`LEARNING_DESIGN_HEADING_ID`) when the publish dialog's prompt
 *     opens the tab, and after what is stored has been loaded instead of what was typed (WCAG 2.4.3).
 *   - After a save the activity is loaded again, so the **Spel** tab shows the new time and purpose.
 *   - The pattern is named from content (`GET /api/studio`), never by its ID; without the overview it is left out.
 * Collaborators: ./useLearningDesignData.ts, ./LearningDesignFormView.tsx, ../activity/tabs/LearningDesignTab.tsx,
 *   ./LearningDesignPrompt.tsx (moves focus to the heading).
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx
 */
'use client';

import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { useState } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { partLanguage } from '../../i18n/partLanguage';
import { t } from '../../i18n/translate';
import { LearningDesignFormView } from './LearningDesignFormView';
import { useLearningDesignData } from './useLearningDesignData';

/** The `id` of the tab's heading, which the publish prompt and a reload move focus to (D-087). */
export const LEARNING_DESIGN_HEADING_ID = 'laeringsdesign-skjema';

/** Moves focus to the tab's heading once the current render is on screen. */
export const focusLearningDesignHeading = (): void => {
  // WHY: the tab panel is shown (and its heading mounted) by the render this call is part of.
  window.setTimeout(() => document.getElementById(LEARNING_DESIGN_HEADING_ID)?.focus(), 0);
};

/** What the panel needs. */
export interface LearningDesignPanelProps {
  readonly detail: ContentDetail;
  /** Says something in the page's polite status region. */
  readonly announce: (message: string) => void;
  /** Loads the activity again after a save (its summary carries the time and purpose). */
  readonly reloadDetail: () => Promise<void>;
}

/**
 * The learning-design tab's content.
 * @param props - The activity, the announcer and the reload handler.
 * @returns The heading and, once loaded, the form.
 */
export function LearningDesignPanel({ detail, announce, reloadDetail }: LearningDesignPanelProps) {
  const locale = useLocale();
  const data = useLearningDesignData(detail.id);
  const [version, setVersion] = useState(0);
  const { design, overview } = data;
  const pattern =
    typeof overview === 'object' && typeof design === 'object' && design.patternId
      ? overview.patterns.find((card) => card.id === design.patternId)?.name[locale]
      : undefined;
  const loadStored = async () => {
    await data.reload();
    setVersion((value) => value + 1);
    focusLearningDesignHeading();
  };
  return (
    <>
      <h2 id={LEARNING_DESIGN_HEADING_ID} tabIndex={-1}>
        {t('learningDesign.heading', locale)}
      </h2>
      <p>{t('learningDesign.intro', locale)}</p>
      {pattern ? <p>{t('learningDesign.fromPattern', locale, { pattern })}</p> : null}
      {design === 'loading' ? <p role="status">{t('common.loading', locale)}</p> : null}
      {design === 'failed' ? <p role="alert">{t('common.loadFailed', locale)}</p> : null}
      {typeof design === 'object' ? (
        <LearningDesignFormView
          key={version}
          contentId={detail.id}
          design={design}
          overview={overview}
          courseCodes={data.courseCodes}
          purposeLang={partLanguage(detail.language, locale)}
          announce={announce}
          onSaved={(saved) => {
            data.setDesign(saved);
            void reloadDetail();
          }}
          onLoadStored={() => void loadStored()}
        />
      ) : null}
    </>
  );
}
