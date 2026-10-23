/**
 * usePortalSession — a React hook that loads the portal session once when a page opens.
 *
 * Why: every portal page first needs to know whether someone is signed in, to show either its content or the Feide
 *      login link (AUTH-001, AUTH-003). Loading it in one hook keeps the pages' states the same.
 * Spec: AUTH-003
 * Invariants:
 *   - Starts as `loading` on the server and in the first client render, so hydration always matches.
 * Collaborators: ./portalSession.ts, ../features/portal/PortalHome.tsx, ../features/activity/*.
 * Tests: apps/web/test/features/PortalHome.test.tsx
 */
'use client';

import { useEffect, useState } from 'react';
import { fetchPortalSession, type PortalSessionResult } from './portalSession';

/** The hook's state: still loading, or the answer. */
export type PortalSessionState = PortalSessionResult | { readonly status: 'loading' };

/**
 * Loads the portal session.
 * @returns The current state.
 */
export function usePortalSession(): PortalSessionState {
  const [state, setState] = useState<PortalSessionState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    void fetchPortalSession().then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}
