/**
 * useMappePreview — keeps the `/mappe` page's word-count preview up to date: a short while after the choice of
 * activities, criteria set or language changes, it asks the server for the Del 1 word count.
 *
 * Why: MAPPE-002 shows "a live word count" of Del 1 against the limit; the server makes the portfolio to count it
 *      (POST /api/mappe/preview), so the page waits until the author pauses instead of asking on every click.
 * Spec: MAPPE-002
 * Invariants:
 *   - Only the newest request's answer counts; an older answer that arrives late is ignored, and the last count stays
 *     on screen until the new one arrives.
 *   - With no activity chosen there is no request and no count.
 *   - Never throws: a failed request is the state `failed`, and the downloads still work.
 * Collaborators: ./MappeWordCount.tsx, ./MappeWorkspace.tsx, ../../api/mappeApi.ts.
 * Tests: apps/web/test/features/MappeView.test.tsx
 */
'use client';

import type { MappePreview, MappeRequest } from '@hvl-interaktiv/api-contract';
import { useEffect, useState } from 'react';
import type { ApiAuth } from '../../api/apiRequest';
import { previewMappe } from '../../api/mappeApi';

/** How long the page waits after a change before it counts, in milliseconds. */
export const PREVIEW_DELAY_MS = 400;

/** The preview's state. */
export type MappePreviewState =
  | { readonly kind: 'none' }
  | { readonly kind: 'counting' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'counted'; readonly preview: MappePreview };

/**
 * The word-count preview of a request.
 * @param request - The chosen activities, set and language; undefined while nothing is chosen.
 * @param auth - The credential.
 * @returns The preview's state.
 */
export function useMappePreview(request: MappeRequest | undefined, auth: ApiAuth): MappePreviewState {
  const [answer, setAnswer] = useState<{ readonly key: string; readonly preview?: MappePreview }>();
  const key = request ? JSON.stringify(request) : '';
  useEffect(() => {
    if (!key) return undefined;
    let current = true;
    const timer = setTimeout(() => {
      void previewMappe(JSON.parse(key) as MappeRequest, auth).then((result) => {
        if (current) setAnswer(result.ok ? { key, preview: result.data } : { key });
      });
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key, auth]);
  if (!key) return { kind: 'none' };
  if (answer?.key === key)
    return answer.preview ? { kind: 'counted', preview: answer.preview } : { kind: 'failed' };
  // WHY: while a new count is on its way the last one stays, so the status region does not flicker and speak twice.
  return answer?.preview ? { kind: 'counted', preview: answer.preview } : { kind: 'counting' };
}
