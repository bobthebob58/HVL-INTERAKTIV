/**
 * useEditorSaved — calls back when the framed H5P editor reports a successful save.
 *
 * Why: the activity page refreshes its findings and player after a save, and the new-activity page moves to the saved
 *      activity (PROD-003); the editor page reports saves with `hvli:content-saved` (./frameMessages.ts).
 * Spec: PROD-003
 * Invariants:
 *   - Only messages from the given frame on our own origin count.
 *   - The listener is removed when the component unmounts.
 * Collaborators: ./frameMessages.ts, ../features/activity/ActivityView.tsx, ../features/activity/NewActivityView.tsx.
 * Tests: apps/web/test/messaging/frameMessages.test.ts
 */
'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { savedContentId } from './frameMessages';

/**
 * Listens for saves of the framed editor.
 * @param frame - The editor frame.
 * @param onSaved - Called with the saved activity's ID.
 */
export function useEditorSaved(
  frame: RefObject<HTMLIFrameElement | null>,
  onSaved: (contentId: string) => void,
) {
  const callback = useRef(onSaved);
  useEffect(() => {
    callback.current = onSaved;
  }, [onSaved]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const contentId = savedContentId(event, frame.current);
      if (contentId) callback.current(contentId);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [frame]);
}
