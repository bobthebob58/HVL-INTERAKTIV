/**
 * useActivityPhase — the læringsdesign phase of the activity on screen, for a tab that shows something for one
 * phase only.
 *
 * Why: the repetition suggestion (PROD-014) is for *Etterarbeid* activities. The phase is part of the learning
 *      design, which only people who may edit the activity can read, and it can change on the **Læringsdesign**
 *      tab while another tab stays mounted.
 * Spec: PROD-014, PED-030
 * Invariants:
 *   - Read again whenever the page has loaded the activity again (it does so after a save of the learning design
 *     and after a change of status), so the answer follows what is stored.
 *   - No request for someone who may not edit; unknown, unreadable or absent is `undefined`, never a guess.
 *   - A phase is given only for the activity it was read for: after a change of activity it is `undefined` until
 *     that activity's own answer has arrived.
 *   - An answer that arrives after a newer request, or after the tab is gone, is dropped.
 * Collaborators: ../../api/learningDesignApi.ts, ../activity/tabs/CheckTab.tsx.
 * Tests: apps/web/test/features/useActivityPhase.test.tsx, apps/web/test/features/CheckTabRepetition.test.tsx
 */
'use client';

import type { ContentDetail, PhaseKey } from '@hvl-interaktiv/api-contract';
import { useEffect, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getLearningDesign } from '../../api/learningDesignApi';

/**
 * The activity's phase.
 * @param detail - The activity as the page last loaded it.
 * @returns The phase, or `undefined` while it is unknown, unset or not this person's to read.
 */
export function useActivityPhase(detail: ContentDetail): PhaseKey | undefined {
  const auth = useApiAuth();
  const [read, setRead] = useState<{ readonly id: string; readonly phase: PhaseKey | undefined }>();
  useEffect(() => {
    if (!detail.mayEdit) return undefined;
    let active = true;
    void getLearningDesign(detail.id, auth).then((result) => {
      if (active) setRead({ id: detail.id, phase: result.ok ? result.data.phase : undefined });
    });
    return () => {
      active = false;
    };
    // WHY: `detail` is a new object each time the page loads the activity again, which is when the phase may differ.
  }, [detail, auth]);
  return detail.mayEdit && read?.id === detail.id ? read.phase : undefined;
}
