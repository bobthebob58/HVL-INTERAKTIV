/**
 * useLearningDesignData — loads what the **Læringsdesign** tab needs: the activity's stored metadata, the studio
 * overview (phase labels and pattern names from content) and the author's course codes.
 *
 * Why: the tab's form (PED-030) starts from the stored metadata and the `updatedAt` it must send back (D-087); the
 *      phase radios take their labels from content only (PED-001), and the course-code field suggests the author's
 *      codes and their Canvas course labels (D-087). Loading them in one hook keeps the panel to its form.
 * Spec: PED-030, PED-001
 * Invariants:
 *   - The metadata decides the state: until it has loaded the form is not shown, and a failure says so; the overview
 *     and the course codes are extras whose failure leaves the form usable (no phase radios, no suggestions).
 *   - `reload` fetches the stored metadata again (after a conflict), and a late answer for an earlier activity is
 *     ignored.
 * Collaborators: ../../api/learningDesignApi.ts, ./LearningDesignPanel.tsx.
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx
 */
'use client';

import type { LearningDesign, StudioOverview } from '@hvl-interaktiv/api-contract';
import { useCallback, useEffect, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getCourseCodes, getLearningDesign, getStudioPhases } from '../../api/learningDesignApi';

/** The stored metadata: loading, failed, or loaded. */
export type StoredDesign = LearningDesign | 'loading' | 'failed';

/** What the tab has loaded. */
export interface LearningDesignData {
  readonly design: StoredDesign;
  /** The studio overview, or `failed` when the phase labels could not be loaded. */
  readonly overview: StudioOverview | 'loading' | 'failed';
  /** The author's course codes and Canvas labels, sorted, without repeats; empty until loaded or on failure. */
  readonly courseCodes: readonly string[];
  /** Fetches the stored metadata again; resolves with it, or undefined when it could not be loaded. */
  readonly reload: () => Promise<LearningDesign | undefined>;
  /** Replaces the stored metadata after a save. */
  readonly setDesign: (design: LearningDesign) => void;
}

/**
 * Loads the tab's data for one activity.
 * @param contentId - The activity.
 * @returns The stored metadata, the overview, the course codes and `reload`.
 */
export function useLearningDesignData(contentId: string): LearningDesignData {
  const auth = useApiAuth();
  const [design, setDesign] = useState<StoredDesign>('loading');
  const [overview, setOverview] = useState<LearningDesignData['overview']>('loading');
  const [courseCodes, setCourseCodes] = useState<readonly string[]>([]);

  useEffect(() => {
    let active = true;
    void getLearningDesign(contentId, auth).then((result) => {
      if (active) setDesign(result.ok ? result.data : 'failed');
    });
    void getStudioPhases(auth).then((result) => {
      if (active) setOverview(result.ok ? result.data : 'failed');
    });
    void getCourseCodes(auth).then((result) => {
      if (!active || !result.ok) return;
      // WHY: Norwegian order, as the server sorts each list (Æ, Ø, Å after Z; SYK20 before SYK110).
      const merged = new Set([...result.data.inUse, ...result.data.fromCanvas]);
      setCourseCodes([...merged].sort((a, b) => a.localeCompare(b, 'nb', { numeric: true })));
    });
    return () => {
      active = false;
    };
  }, [contentId, auth]);

  const reload = useCallback(async () => {
    const result = await getLearningDesign(contentId, auth);
    setDesign(result.ok ? result.data : 'failed');
    return result.ok ? result.data : undefined;
  }, [contentId, auth]);

  return { design, overview, courseCodes, reload, setDesign };
}
