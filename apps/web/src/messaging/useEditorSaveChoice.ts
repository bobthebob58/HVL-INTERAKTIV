/**
 * useEditorSaveChoice — the page's side of the editor's save choice (PROD-013): keeps the page's own controls inert
 * while the dialog in the editor frame is open, and hands on the copy that «Lagre som ny versjon» made.
 *
 * Why: the dialog is modal only inside its frame (probe P7, D-093), so the editor page tells its parent when it
 *      opens and closes it (`hvli:modal-open`, `hvli:modal-closed`); after a copy it tells which activity to open
 *      (`hvli:content-copied`), since the edit now lives in that new private draft.
 * Spec: PROD-013, UD-006
 * Invariants:
 *   - Only messages from the given frame on our own origin count (./frameMessages.ts).
 *   - The page is inert outside the frame from `hvli:modal-open` until `hvli:modal-closed`, the frame loading another
 *     document, or the component unmounting, whichever comes first; never twice at once.
 *   - A copy's ID is handed on only when it looks like an activity ID.
 * Collaborators: ./frameMessages.ts, ./inertOutside.ts, ../features/activity/ActivityView.tsx,
 *   ../features/lti/LtiPlayView.tsx.
 * Tests: apps/web/test/features/ActivitySaveChoice.test.tsx
 */
'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { copiedContentId, modalChange } from './frameMessages';
import { inertOutside } from './inertOutside';

/**
 * Follows the save choice of the framed editor.
 * @param frame - The editor frame.
 * @param onCopied - Called with the new activity's ID after «Lagre som ny versjon»; absent where no copy is offered.
 */
export function useEditorSaveChoice(
  frame: RefObject<HTMLIFrameElement | null>,
  onCopied?: (contentId: string) => void,
) {
  const callback = useRef(onCopied);
  useEffect(() => {
    callback.current = onCopied;
  }, [onCopied]);
  useEffect(() => {
    let release: (() => void) | undefined;
    const reachable = () => {
      release?.();
      release = undefined;
    };
    const listener = (event: MessageEvent) => {
      const element = frame.current;
      const change = modalChange(event, element);
      if (change === 'open' && element && !release) {
        release = inertOutside(element);
        // WHY: a frame that loads another document has no dialog any more, and would never say it closed.
        element.addEventListener('load', reachable, { once: true });
      }
      if (change === 'closed') reachable();
      const copy = copiedContentId(event, element);
      if (copy) callback.current?.(copy);
    };
    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
      reachable();
    };
  }, [frame]);
}
