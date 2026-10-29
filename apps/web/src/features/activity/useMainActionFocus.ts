/**
 * useMainActionFocus — puts focus on the check panel's main action (**Publiser** or **Gjer om til utkast**) after the
 * render that applied a request: always after a publish, or only when the focused control went away.
 *
 * Why: UD-006 and WCAG 2.4.3: after a publish, a retry that worked or a closed dialog, focus must land on a sensible
 *      control, never on `body`. The rule is apart from ../activity/CheckPanel.tsx so that the panel stays within
 *      DOC-007's 200 lines while the publish dialog gains the learning-design prompt (D-087); its behaviour is the
 *      panel's own from S4, unchanged.
 * Spec: UD-006, PROD-003
 * Invariants:
 *   - A request is state, not a ref, so an effect still pending from an earlier render cannot take it; each request
 *     runs once, after the render that closed the dialog (which returned focus to its opener if still on the page)
 *     or showed the findings.
 *   - `'ifLost'` moves focus only when nothing (or `body`) has it.
 * Collaborators: ./CheckPanel.tsx.
 * Tests: apps/web/test/features/CheckPanelFocus.test.tsx
 */
'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** When the render that applies a request puts focus on the main action: always (after a publish), or if it was lost. */
export type FocusAfter = 'always' | 'ifLost' | null;

/** The main action's ref and the way to ask for focus on it. */
export interface MainActionFocus {
  /** Put on the main action's button. */
  readonly mainAction: RefObject<HTMLButtonElement | null>;
  /** Asks for focus after the next render; `null` asks for nothing. */
  readonly requestFocus: (mode: FocusAfter) => void;
}

/**
 * The check panel's focus rule.
 * @returns The main action's ref and `requestFocus`.
 */
export function useMainActionFocus(): MainActionFocus {
  const [focusRequest, setFocusRequest] = useState<{ readonly mode: FocusAfter }>({ mode: null });
  const mainAction = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // A11Y: WCAG 2.4.3: runs once per request, after the render that closed the dialog (which returned focus to its
    // opener if still on the page) or showed the findings; the main action stays (shown only with `mayPublish`).
    const lost = !document.activeElement || document.activeElement === document.body;
    if (focusRequest.mode === 'always' || (focusRequest.mode && lost)) mainAction.current?.focus();
  }, [focusRequest]);
  const requestFocus = useCallback((mode: FocusAfter) => setFocusRequest({ mode }), []);
  return { mainAction, requestFocus };
}
