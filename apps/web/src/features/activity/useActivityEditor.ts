/**
 * useActivityEditor — the activity page's side of its **Rediger** frame: the frame's ref, «Gå til feltet» once the
 * editor has loaded, the editor's saves, and its save choice (PROD-013).
 *
 * Why: the editor reports each save (`hvli:content-saved`), takes «Gå til feltet» (`hvli:go-to-field`, PROD-003),
 *      and, while its save choice is open, needs the page's own controls inert; after «Lagre som ny versjon» it names
 *      the copy to open (`hvli:content-copied`, D-093). One hook keeps these frame messages together, so
 *      ../activity/ActivityView.tsx stays about the page.
 * Spec: PROD-003, PROD-013, UD-006
 * Invariants:
 *   - «Gå til feltet» opens the **Rediger** tab and posts its path once, after the editor frame has loaded.
 *   - Only messages from this page's editor frame on our own origin count (../../messaging/frameMessages.ts).
 * Collaborators: ./ActivityView.tsx, ./tabs/EditTab.tsx, ../../messaging/useEditorSaved.ts,
 *   ../../messaging/useEditorSaveChoice.ts, ../../messaging/frameMessages.ts.
 * Tests: apps/web/test/features/ActivityView.test.tsx, apps/web/test/features/ActivitySaveChoice.test.tsx
 */
'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { postGoToField } from '../../messaging/frameMessages';
import { useEditorSaved } from '../../messaging/useEditorSaved';
import { useEditorSaveChoice } from '../../messaging/useEditorSaveChoice';
import { EDIT_TAB_ID } from './tabs/EditTab';

/** What the page tells the hook. */
export interface ActivityEditorOptions {
  /** The selected tab's `id`. */
  readonly tab: string | undefined;
  /** Selects a tab. */
  readonly setTab: (id: string) => void;
  /** Called after each save in the editor. */
  readonly onSaved: () => void;
  /** Called with the new activity's ID after «Lagre som ny versjon». */
  readonly onCopied: (contentId: string) => void;
}

/** What the page hands its tabs. */
export interface ActivityEditor {
  readonly editorRef: RefObject<HTMLIFrameElement | null>;
  /** Opens **Rediger** and asks the editor to focus the field at an H5P params path. */
  readonly goToField: (path: string) => void;
  /** The editor frame's load handler. */
  readonly onEditorLoad: () => void;
}

/**
 * Follows the activity page's editor frame.
 * @param options - The selected tab, how to select one, and what to do after a save and after a copy.
 * @returns The frame's ref, «Gå til feltet» and the frame's load handler.
 */
export function useActivityEditor({ tab, setTab, onSaved, onCopied }: ActivityEditorOptions): ActivityEditor {
  const editorRef = useRef<HTMLIFrameElement>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [goTo, setGoTo] = useState<{ readonly path: string; readonly at: number }>();
  const postedAt = useRef(0);

  const goToField = useCallback(
    (path: string) => {
      setTab(EDIT_TAB_ID);
      setGoTo({ path, at: Date.now() });
    },
    [setTab],
  );
  useEditorSaved(editorRef, onSaved);
  useEditorSaveChoice(editorRef, onCopied);

  useEffect(() => {
    if (!goTo || tab !== EDIT_TAB_ID || !editorReady || postedAt.current === goTo.at) return;
    postedAt.current = goTo.at;
    postGoToField(editorRef.current, goTo.path);
  }, [goTo, tab, editorReady]);

  const onEditorLoad = useCallback(() => setEditorReady(true), []);
  return { editorRef, goToField, onEditorLoad };
}
