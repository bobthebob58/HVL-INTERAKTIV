/**
 * useFocusAfterChange — moves focus once a change has rendered: a section asks for focus in the same step as the
 * state update that shows the server's answer, and the focus runs in the effect of the commit that renders the request.
 *
 * Why: WCAG 2.4.3 Focus Order: after a change on the **Deling** tab the pressed button is often gone, so the section
 *      moves focus to what replaced it, which exists only once the answer has rendered. A request kept in a ref and
 *      run by an effect keyed on the shown value is not enough: React may run the effect of an EARLIER commit after
 *      the request was made (it runs a commit's effects in a later task and flushes them first when the next update
 *      renders). That effect focused an element that did not exist yet and cleared the request, and focus fell to
 *      `body` (S5 gate, under CPU load). Tying the request to one value instead loses it when a newer state replaces
 *      that value before it renders (S5 review). A request held in state is part of the render it is batched into, as
 *      in ../features/activity/useMainActionFocus.ts.
 * Spec: UD-006, PROD-007
 * Invariants:
 *   - A request is state, not a ref: an effect still pending from an earlier commit has unchanged dependencies and
 *     never runs it; the effect of the commit that renders the request runs it, once, also when React runs that
 *     effect again (a hidden `<Activity>` shown again, Fast Refresh).
 *   - Asked for in the same synchronous step as the state update that shows the answer, the request renders with that
 *     answer, or with a newer state that replaced the answer before it rendered; the focus then looks for its target
 *     in what that commit shows, so a caller whose answer a newer state may replace gives the focus a target in that
 *     state too.
 *   - A request renders even when the answer equals the state already shown (the request itself is new); a newer
 *     request asked for before an older one has rendered replaces it.
 * Collaborators: ../features/sharing/CoAuthorSection.tsx, ../features/sharing/BankListingSection.tsx.
 * Tests: apps/web/test/components/useFocusAfterChange.test.tsx, apps/web/test/features/sharingFocusRace.test.tsx
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Asks for `focus` to run once the state updates made in the same step have rendered. */
export type FocusAfterChange = (focus: () => void) => void;

/**
 * Focus that waits for the commit that renders the request.
 * @returns `focusAfter(focus)`, the same function on every render.
 * @example
 * const focusAfter = useFocusAfterChange();
 * focusAfter(() => heading.current?.focus());
 * setList(answer);
 */
export function useFocusAfterChange(): FocusAfterChange {
  const [request, setRequest] = useState<{ readonly focus: () => void }>();
  const ran = useRef<typeof request>(undefined);

  useEffect(() => {
    // A11Y: WCAG 2.4.3: runs in the effect of the commit that rendered the request, so what it focuses is on screen.
    // An effect still pending from an earlier commit holds that commit's `request`, never this one.
    // WHY: React runs effects again without a new request when hidden content is shown again; focus moved then already.
    if (!request || ran.current === request) return;
    ran.current = request;
    request.focus();
  }, [request]);

  return useCallback((focus: () => void) => setRequest({ focus }), []);
}
