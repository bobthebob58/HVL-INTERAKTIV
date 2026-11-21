/**
 * useUnpublish — the request that turns a published activity back into a draft, one at a time, with its outcome
 * said to the person.
 *
 * Why: the **Sjekk og publiser** tab asks before it unpublishes (D-125); the request itself, its busy state and its
 *      two outcomes are one small thing the panel only starts. Unpublishing sends the `updatedAt` of the findings
 *      on screen, so a change made meanwhile is refused and said (D-074).
 * Spec: PROD-003, UD-013
 * Invariants:
 *   - One request at a time: while one runs, `unpublish` does nothing and `busy` is true.
 *   - Success is announced; a refusal sets the problem text (a changed activity has its own). Afterwards the caller's
 *     `reload` runs, whatever the outcome.
 * Collaborators: ./CheckPanel.tsx (the only caller), ../../api/contentApi.ts.
 * Tests: apps/web/test/features/CheckPanel.test.tsx, apps/web/test/features/CheckPanelTransitions.test.tsx
 */
'use client';

import { useRef, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { unpublishContent } from '../../api/contentApi';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** What the request needs from the panel. */
export interface UnpublishInput {
  readonly contentId: string;
  /** The `updatedAt` the person saw: the findings', or the activity's while there are none. */
  readonly updatedAt: string;
  readonly announce: (text: string) => void;
  readonly setProblem: (text: string) => void;
  /** Reads the activity and its findings again. */
  readonly reload: () => Promise<unknown>;
}

/** The request and its state. */
export interface Unpublish {
  /** True while a request runs. */
  readonly busy: boolean;
  /** Whether a request runs right now (the state may lag one render). */
  readonly isPending: () => boolean;
  readonly unpublish: () => Promise<void>;
}

/**
 * The unpublish request of one activity.
 * @param input - The activity, what the person saw, and where outcomes go.
 * @returns The request, and whether one is running.
 */
export function useUnpublish({
  contentId,
  updatedAt,
  announce,
  setProblem,
  reload,
}: UnpublishInput): Unpublish {
  const locale = useLocale();
  const auth = useApiAuth();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const unpublish = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setProblem('');
    try {
      const result = await unpublishContent(contentId, { updatedAt }, auth);
      if (result.ok) announce(t('activity.unpublished', locale));
      else
        setProblem(
          result.error?.errorCode === 'hvl:content-changed'
            ? t('publish.changed', locale)
            : t('activity.unpublishFailed', locale),
        );
      await reload();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { busy, isPending: () => pending.current, unpublish };
}
