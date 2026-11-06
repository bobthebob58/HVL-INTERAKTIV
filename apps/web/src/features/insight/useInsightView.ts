/**
 * useInsightView — loads the Innsikt tab's view: the period, version and context the teacher applied, the server's
 * already suppressed answer for them, and, in the portal, the contexts the activity can be viewed for.
 *
 * Why: the tab shows one activity, one version and one context at a time (D-106), and the server decides who may see
 *      which (INS-007). On the activity page the teacher picks the context (portal first); in Canvas the launch fixes
 *      it, so no context is sent at all. While a new view loads the previous one stays on screen, so the reader keeps
 *      their place; the panel says when the new one has arrived. The last view that arrived is kept apart from the
 *      state, so a refused or failed request does not take away the versions to choose from or the shortlist.
 * Spec: INS-001, INS-007, PROD-013, PROD-010
 * Invariants:
 *   - The first view is the last 7 days, the current version and, in the portal, the portal's plays.
 *   - Only the newest request may set the view: an answer to an older query is dropped.
 *   - 403 and 404 are "unavailable", 400 "invalid" (a version or context the activity lacks), anything else "failed".
 *   - If the contexts cannot be loaded, the portal alone is offered; the server still checks every view.
 *   - `latest` is the newest view that arrived; it is never cleared by a refusal, only replaced by a newer view.
 *   - `refusals` grows with every refused, invalid or failed answer, also when it repeats the one before.
 * Collaborators: ./insightApi.ts, ./insightPeriods.ts, ./insightContextLabels.ts, ./InsightPanel.tsx,
 *   ../../api/ApiAuthContext.tsx.
 * Tests: apps/web/test/features/insight/InsightPanel.test.tsx, apps/web/test/features/insight/InsightQuery.test.tsx,
 *   apps/web/test/features/insight/InsightViewState.test.tsx
 */
'use client';

import type { InsightContext, InsightQuery } from '@hvl-interaktiv/api-contract';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getInsight, getInsightContexts } from './insightApi';
import { PORTAL_CONTEXT } from './insightContextLabels';
import { DEFAULT_PERIOD } from './insightPeriods';
import type { InsightReport } from './insightReportShape';

/** What the tab shows: a view, or why it shows none. */
export type InsightViewState = InsightReport | 'loading' | 'unavailable' | 'invalid' | 'failed';

/** The tab's view and how to change it. */
export interface InsightView {
  /** The query of the view asked for last. */
  readonly query: InsightQuery;
  readonly state: InsightViewState;
  /** True while a newer view than the one shown is loading. */
  readonly pending: boolean;
  /** Counts the refused, invalid and failed answers, so each one can mount a new alert. */
  readonly refusals: number;
  /** The newest view that arrived, also while a later request is refused or failed; undefined before the first. */
  readonly latest: InsightReport | undefined;
  /** The contexts to choose from (portal only); undefined in Canvas and while they load. */
  readonly contexts: readonly InsightContext[] | undefined;
  /** Asks for another view. */
  readonly apply: (query: InsightQuery) => void;
}

const PORTAL_ONLY: readonly InsightContext[] = [{ key: PORTAL_CONTEXT, label: null }];

/**
 * The Innsikt tab's view.
 * @param contentId - The activity.
 * @param fixedContext - True in Canvas: the launch fixes the context, and none is sent.
 * @param onUpdated - Called with each view that arrives after `apply`, e.g. to announce it.
 * @returns The view, its query and `apply`.
 */
export function useInsightView(
  contentId: string,
  fixedContext: boolean,
  onUpdated: (report: InsightReport) => void,
): InsightView {
  const auth = useApiAuth();
  const [query, setQuery] = useState<InsightQuery>(() =>
    fixedContext ? { period: DEFAULT_PERIOD } : { period: DEFAULT_PERIOD, context: PORTAL_CONTEXT },
  );
  const [state, setState] = useState<InsightViewState>('loading');
  const [pending, setPending] = useState(false);
  const [refusals, setRefusals] = useState(0);
  const [latest, setLatest] = useState<InsightReport>();
  const [contexts, setContexts] = useState<readonly InsightContext[]>();
  const loads = useRef(0);
  const applied = useRef(false);
  const updated = useRef(onUpdated);
  useEffect(() => {
    updated.current = onUpdated;
  }, [onUpdated]);

  useEffect(() => {
    if (fixedContext) return;
    let active = true;
    void getInsightContexts(contentId, auth).then((result) => {
      if (!active) return;
      setContexts(result.ok && result.data.contexts.length > 0 ? result.data.contexts : PORTAL_ONLY);
    });
    return () => {
      active = false;
    };
  }, [contentId, auth, fixedContext]);

  useEffect(() => {
    const load = ++loads.current;
    void getInsight(contentId, query, auth).then((result) => {
      // WHY: a teacher may apply twice before the first answer comes; only the newest may be shown.
      if (load !== loads.current) return;
      setPending(false);
      if (!result.ok) {
        // A11Y: the same refusal twice leaves the state unchanged; the count makes it a new alert (WCAG 4.1.3).
        setRefusals((count) => count + 1);
        if (result.status === 403 || result.status === 404) setState('unavailable');
        else setState(result.status === 400 ? 'invalid' : 'failed');
        return;
      }
      setState(result.data);
      setLatest(result.data);
      if (applied.current) updated.current(result.data);
    });
  }, [contentId, auth, query]);

  const apply = useCallback((next: InsightQuery) => {
    applied.current = true;
    setPending(true);
    setQuery(next);
  }, []);

  return { query, state, pending, refusals, latest, contexts, apply };
}
