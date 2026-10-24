/**
 * useAnnouncement — the text of a polite status region that is announced every time, also when the same message
 * comes twice in a row.
 *
 * Why: WCAG 4.1.3 Status Messages: a live region speaks only when its content changes, and React writes nothing to the
 *      DOM for a state equal to the last one. "Endringane er lagra …" after a second save was therefore never heard.
 *      Every second announcement of the same words ends with a no-break space, which a screen reader does not read but
 *      which changes the region, so it speaks again.
 * Spec: UD-006, PROD-003
 * Invariants:
 *   - The visible and spoken words are the message; only an invisible trailing no-break space alternates.
 *   - The region itself stays mounted (a region added with its text is often not announced at all).
 * Collaborators: ../features/activity/ActivityView.tsx, ../features/activity/CheckPanel.tsx.
 * Tests: apps/web/test/components/useAnnouncement.test.tsx, apps/web/test/features/ActivityView.test.tsx
 */
'use client';

import { useCallback, useRef, useState } from 'react';

/** The character that makes a repeated message differ from the previous one. */
export const NO_BREAK_SPACE = '\u00a0';

/**
 * The text of a status region and the function that announces a message in it.
 * @returns The current text, and `announce(message)`.
 */
export function useAnnouncement(): readonly [string, (message: string) => void] {
  const [text, setText] = useState('');
  const count = useRef(0);
  const announce = useCallback((message: string) => {
    count.current += 1;
    // A11Y: WCAG 4.1.3: a different string each time, so the region changes and is read again.
    setText(count.current % 2 === 0 ? `${message}${NO_BREAK_SPACE}` : message);
  }, []);
  return [text, announce] as const;
}
