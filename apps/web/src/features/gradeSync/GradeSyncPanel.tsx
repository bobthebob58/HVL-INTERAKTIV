/**
 * GradeSyncPanel — the grade-sync view of an activity, on the portal's **Poeng til Canvas** tab and in the Canvas
 * page for authors: the formative label, then each placement the person may see with its scores sent, waiting,
 * failed and deleted, and a button that sends the failed ones again.
 *
 * Why: LTI-012's acceptance has authors see a per-activity sync status and retry failed jobs, on the activity page and
 *      in `/app/play` (D-104); D-105 has the view say the scores are formative. The server decides which placements
 *      the person sees (D-106): every one in the portal, the launch's course in Canvas.
 * Spec: LTI-012, LTI-013, LTI-006, UD-006, UD-003
 * Invariants:
 *   - PRIVACY: counts only; the panel never asks for or shows a learner (DATA-002).
 *   - A11Y: one `h2`; the formative label and each placement are sections named by their `h3`. A retry's outcome is
 *     said in the panel's own polite status region, which stays mounted and repeats the same words when they come
 *     twice (WCAG 4.1.3); focus the removed button held moves to the placement's heading (WCAG 2.4.3).
 *   - One retry at a time; after it the counts are read again, so the panel shows what the server holds.
 *   - Works with the page's credential (`useApiAuth`): the session and CSRF token, or the Canvas ltik.
 * Collaborators: ./gradeSyncApi.ts, ./GradeSyncPlacementSection.tsx, ./FormativeScoresNote.tsx, ./gradeSyncTexts.ts,
 *   ../activity/tabs/GradeSyncTab.tsx, ../lti/LtiPlayView.tsx, ../../components/useAnnouncement.ts,
 *   ../../components/useFocusAfterChange.ts.
 * Tests: apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx
 */
'use client';

import type { GradeSyncPlacement, GradeSyncStatusResponse } from '@hvl-interaktiv/api-contract';
import { useEffect, useRef, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { useAnnouncement } from '../../components/useAnnouncement';
import { useFocusAfterChange } from '../../components/useFocusAfterChange';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { FormativeScoresNote } from './FormativeScoresNote';
import { getGradeSync, retryGradeSync } from './gradeSyncApi';
import { GradeSyncPlacementSection, type GradeSyncFeedback } from './GradeSyncPlacementSection';
import { placementHeading, retryMessage } from './gradeSyncTexts';

type Status = GradeSyncStatusResponse | 'loading' | 'unavailable' | 'failed';

/**
 * The grade-sync panel of one activity.
 * @param props - The activity's ID.
 * @returns The panel.
 */
export function GradeSyncPanel({ contentId }: { readonly contentId: string }) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState<string>();
  const [feedback, setFeedback] = useState<Readonly<Record<string, GradeSyncFeedback>>>({});
  const [announcement, announce] = useAnnouncement();
  const focusAfter = useFocusAfterChange();
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  const refusals = useRef(0);
  // WHY: a second press before React renders `busy` must not send a second request (one retry at a time).
  const sending = useRef(false);

  useEffect(() => {
    let active = true;
    void getGradeSync(contentId, auth).then((result) => {
      if (!active) return;
      if (result.ok) setStatus(result.data);
      else setStatus(result.status === 403 || result.status === 404 ? 'unavailable' : 'failed');
    });
    return () => {
      active = false;
    };
  }, [contentId, auth]);

  const retry = async (placement: GradeSyncPlacement, heading: string) => {
    if (sending.current) return;
    sending.current = true;
    const id = placement.placementId;
    setBusy(id);
    const result = await retryGradeSync(contentId, id, auth);
    if (!result.ok) {
      sending.current = false;
      setBusy(undefined);
      const number = ++refusals.current;
      const text = result.error?.message ?? t('gradeSync.retryFailed', locale);
      setFeedback((now) => ({ ...now, [id]: { kind: 'problem', text, number } }));
      return;
    }
    const text = retryMessage(result.data, locale);
    const reread = await getGradeSync(contentId, auth);
    // A11Y: WCAG 2.4.3: the button is gone once no failed score is left; focus it held moves to the heading.
    focusAfter(() => {
      if (!document.activeElement || document.activeElement === document.body)
        headings.current.get(id)?.focus();
    });
    if (reread.ok) setStatus(reread.data);
    sending.current = false;
    setBusy(undefined);
    setFeedback((now) => ({ ...now, [id]: { kind: 'done', text } }));
    announce(t('gradeSync.announcement', locale, { placement: heading, message: text }));
  };

  let body;
  if (status === 'loading') body = <p role="status">{t('common.loading', locale)}</p>;
  else if (status === 'unavailable') body = <p role="alert">{t('gradeSync.unavailable', locale)}</p>;
  else if (status === 'failed') body = <p role="alert">{t('common.loadFailed', locale)}</p>;
  else if (status.placements.length === 0) body = <p>{t('gradeSync.none', locale)}</p>;
  else {
    const { placements } = status;
    body = placements.map((placement) => {
      const heading = placementHeading(placement, placements, locale);
      return (
        <GradeSyncPlacementSection
          key={placement.placementId}
          placement={placement}
          heading={heading}
          headingRef={(element) => {
            if (element) headings.current.set(placement.placementId, element);
            else headings.current.delete(placement.placementId);
          }}
          busy={busy === placement.placementId}
          feedback={feedback[placement.placementId]}
          onRetry={() => void retry(placement, heading)}
        />
      );
    });
  }

  return (
    <>
      <h2>{t('gradeSync.heading', locale)}</h2>
      <FormativeScoresNote />
      <p>{t('gradeSync.intro', locale)}</p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {body}
    </>
  );
}
