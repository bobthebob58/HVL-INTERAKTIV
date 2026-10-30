/**
 * useApiLoad — a React hook that loads one API answer when a studio page opens (or its key changes), and keeps the
 * state of the request: loading, the data, or the failed status.
 *
 * Why: the studio pages read the guide, the overview and a pattern from the API in the browser (D-068); each needs
 *      the same three states, and the page's language decides which guide to fetch (PED-002).
 * Spec: PED-002, PED-010
 * Invariants:
 *   - Starts as `loading` on the server and in the first client render, so hydration always matches.
 *   - An answer that arrives after the key changed or the page closed is dropped.
 * Collaborators: ../../api/studioApi.ts, ./GuideView.tsx, ./PatternDetailView.tsx.
 * Tests: apps/web/test/features/GuideView.test.tsx, apps/web/test/features/PatternDetailView.test.tsx
 */
'use client';

import { useEffect, useState } from 'react';
import type { ApiResult } from '../../api/apiRequest';

/** The state of one request. */
export type ApiLoadState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly data: T }
  /** `httpStatus` is 0 when the server could not be reached. */
  | { readonly status: 'failed'; readonly httpStatus: number };

/**
 * Loads one API answer.
 * @param load - The request; called again whenever `key` changes.
 * @param key - What the request depends on, e.g. the locale or the pattern ID.
 * @returns The current state.
 */
export function useApiLoad<T>(load: () => Promise<ApiResult<T>>, key: string): ApiLoadState<T> {
  const [state, setState] = useState<{ key: string; value: ApiLoadState<T> }>({
    key,
    value: { status: 'loading' },
  });
  useEffect(() => {
    let active = true;
    void load().then((result) => {
      if (!active) return;
      setState({
        key,
        value: result.ok
          ? { status: 'loaded', data: result.data }
          : { status: 'failed', httpStatus: result.status },
      });
    });
    return () => {
      active = false;
    };
    // WHY: `load` is a new function on every render; the request depends only on `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state.value : { status: 'loading' };
}
