/**
 * H5pFrame — the iframe that shows one of Express's H5P pages (player or editor) inside a web page.
 *
 * Why: the H5P pages stay server-rendered under their own strict policy and are framed on the same origin (D-067).
 *      Every frame has a title (WCAG 4.1.2), and a player frame takes the height of its content (./../messaging/
 *      useH5pResizer.ts), so the page has one scroll area at 320 px (UD-008).
 * Spec: UD-008, UD-006, H5P-001
 * Invariants:
 *   - `src` is a same-origin path built by our pages, never taken from a message or the address bar.
 *   - The editor frame (`editor`) is tall and scrolls itself; it does not speak H5P's resize protocol.
 *   - `allow="fullscreen"` only: no camera, microphone or other powers for H5P content.
 * Collaborators: ../messaging/useH5pResizer.ts, ../features/activity/ActivityView.tsx, ../features/lti/LtiPlayView.tsx.
 * Tests: apps/web/test/components/H5pFrame.test.tsx
 */
'use client';

import type { RefObject } from 'react';
import { useH5pResizer } from '../messaging/useH5pResizer';

/** What the frame needs. */
export interface H5pFrameProps {
  /** A same-origin path, e.g. `/h5p/play/<id>`. */
  readonly src: string;
  /** The frame's accessible name. */
  readonly title: string;
  /** The editor page: tall, scrolls itself and does not speak H5P's resize protocol. */
  readonly editor?: boolean;
  readonly frameRef: RefObject<HTMLIFrameElement | null>;
  readonly onLoad?: () => void;
}

/**
 * A titled frame for an H5P page.
 * @param props - Source, title, whether it is the editor, the ref the page keeps, and a load handler.
 * @returns The iframe.
 */
export function H5pFrame({ src, title, editor = false, frameRef, onLoad }: H5pFrameProps) {
  useH5pResizer(frameRef, !editor);
  return (
    <iframe
      ref={frameRef}
      src={src}
      title={title}
      allow="fullscreen"
      onLoad={onLoad}
      className={`block w-full border-0 bg-hvl-surface ${editor ? 'h-[85vh] min-h-96' : 'min-h-96'}`}
    />
  );
}
