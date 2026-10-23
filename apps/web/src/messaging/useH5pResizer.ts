/**
 * useH5pResizer — gives a framed H5P player the height of its content, as H5P's own `h5p-resizer.js` does.
 *
 * Why: the player page renders the activity inside our frame (D-067). H5P Core in a framed page asks its parent for
 *      a height through `postMessage` (`hello`, `prepareResize`, `resize`); answering it means no scroll area inside
 *      the page, which matters at 320 px (UD-008). We answer it ourselves because the resizer script is H5P's.
 * Spec: UD-008, H5P-001
 * Invariants:
 *   - Only messages with `context: 'h5p'` from the given frame on our own origin are answered.
 *   - Answers go to our own origin only; the height is set through the DOM, never as a style attribute (D-070).
 * Collaborators: ../components/H5pFrame.tsx, apps/server/h5p/core/js/h5p.js (`H5P.communicator`).
 * Tests: apps/web/test/messaging/useH5pResizer.test.tsx
 */
'use client';

import { useEffect, type RefObject } from 'react';
import { isFromFrame } from './frameMessages';

interface H5pMessage {
  readonly context?: unknown;
  readonly action?: unknown;
  readonly scrollHeight?: unknown;
  readonly clientHeight?: unknown;
}

const pixels = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.ceil(value) : undefined;

/**
 * Answers the framed player's resize requests.
 * @param frame - The player frame.
 * @param enabled - False for frames that do not speak H5P's protocol (the editor).
 */
export function useH5pResizer(frame: RefObject<HTMLIFrameElement | null>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const respond = (action: string) =>
      frame.current?.contentWindow?.postMessage({ context: 'h5p', action }, window.location.origin);
    const onMessage = (event: MessageEvent) => {
      const element = frame.current;
      if (!element || !isFromFrame(event, element)) return;
      const data = (event.data ?? {}) as H5pMessage;
      if (data.context !== 'h5p') return;
      // WHY: the same three steps as H5P Core's js/h5p-resizer.js (tag 1.28.0), which an H5P page expects.
      if (data.action === 'hello') respond('hello');
      if (data.action === 'prepareResize') {
        const height = pixels(data.clientHeight);
        if (height !== undefined) element.style.height = `${height}px`;
        respond('resizePrepared');
      }
      if (data.action === 'resize') {
        const height = pixels(data.scrollHeight);
        if (height !== undefined) element.style.height = `${height}px`;
      }
    };
    const onWindowResize = () => respond('resize');
    window.addEventListener('message', onMessage);
    window.addEventListener('resize', onWindowResize);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', onWindowResize);
    };
  }, [frame, enabled]);
}
