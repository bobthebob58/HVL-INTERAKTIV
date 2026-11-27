/**
 * useQuotedAnnouncement — the Innsikt tab's polite status region for sentences that may quote a text from the
 * activity: the last message, with its quoted part in the activity's language, announced every time.
 *
 * Why: WCAG 3.1.2 and UD-010: «“Why do cells divide?” er lagt til i lista til samlinga» quotes the question in the
 *      activity's language, so a screen reader should read that part in it. WCAG 4.1.3 still needs a repeat of the
 *      same words to change the region; ../../components/useAnnouncement.ts does that for every feature, so this hook
 *      builds on it rather than changing it.
 * Spec: UD-010, UD-006, INS-003
 * Invariants:
 *   - The region's text is exactly `useAnnouncement`'s: the message, and on every second repeat a no-break space.
 *   - Only the quoted range carries `lang` (./quotedText.tsx); a plain message has none.
 *   - A repeat changes a text and never adds or removes a node: a live region does not speak for a removed one.
 * Collaborators: ../../components/useAnnouncement.ts, ./quotedText.tsx, ./InsightPanel.tsx, ./shortlistContext.tsx.
 * Tests: apps/web/test/features/insight/quotedText.test.tsx,
 *   apps/web/test/features/insight/InsightQuotedLanguage.test.tsx
 */
'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useAnnouncement } from '../../components/useAnnouncement';
import { plainText, Quoted, type QuotedText } from './quotedText';

const NOTHING = plainText('');

/**
 * The content of a status region and the function that announces a sentence in it.
 * @returns The region's content, and `announce(message)`.
 */
export function useQuotedAnnouncement(): readonly [ReactNode, (message: QuotedText) => void] {
  const [text, announceText] = useAnnouncement();
  const [last, setLast] = useState<QuotedText>(NOTHING);
  const announce = useCallback(
    (message: QuotedText) => {
      setLast(message);
      announceText(message.text);
    },
    [announceText],
  );
  // A11Y: WCAG 4.1.3: a live region speaks for added nodes and changed text, not for a removed node. `text` is
  // `last.text` plus what useAnnouncement appended (the repeat's no-break space); it is written as part of the
  // sentence's last text, so a repeat changes a text and never adds or removes a node.
  const node = <Quoted value={{ ...last, text }} />;
  return [node, announce] as const;
}
