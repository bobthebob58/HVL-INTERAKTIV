/**
 * Notice — the formative-use notice next to the editor: H5P scores are computed in the browser and are meant for
 * formative work, not exams. It can be dismissed, and the dismissal is remembered per user.
 *
 * Why: PROD-011 and CLAUDE.md's "formative only" rule. The server stores dismissals per user and notice version
 *      (D-075): the notice reads them from `GET /api/me` and records one with `PUT /api/me/notices/formative-use`,
 *      with the page's credential (session and CSRF token, or the Canvas ltik).
 * Spec: PROD-011, UD-003, UD-006
 * Invariants:
 *   - Hidden while the dismissals load, so it never flashes; shown when they cannot be read (it fails visible).
 *   - A new `NOTICE_VERSIONS` value shows the notice again to everyone who dismissed an older one.
 *   - A failed dismissal keeps the notice and says so; the person can try again.
 *   - It is a labelled region, not an alert: it is information, not an interruption.
 *   - Dismissing it moves focus to the panel or `main` around it, because the focused button disappears with the
 *     notice (WCAG 2.4.3; the Deep Linking picker moves focus to its heading for the same reason).
 * Collaborators: ../api/meApi.ts, ../api/ApiAuthContext.tsx, ../features/activity/*, ../features/lti/LtiPlayView.tsx.
 * Tests: apps/web/test/components/Notice.test.tsx
 */
'use client';

import type { NoticeId } from '@hvl-interaktiv/api-contract';
import { useEffect, useId, useRef, useState } from 'react';
import { useApiAuth } from '../api/ApiAuthContext';
import { dismissNotice, getMe } from '../api/meApi';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n/translate';

/** The current version of each notice's text; raise it when the text changes in substance. */
export const NOTICE_VERSIONS: Readonly<Record<NoticeId, number>> = { 'formative-use': 1 };

/** Where focus goes when the notice disappears: the tab panel around it, else the page's `main`. */
export const FOCUS_AFTER_DISMISS = '[role="tabpanel"], main';

/** The information icon shown before the notice's title. */
export const INFO_ICON = 'ℹ︎';

type State = 'loading' | 'shown' | 'failed' | 'dismissed';

/**
 * The formative-use notice.
 * @param props - The notice to show; `formative-use` is the only one.
 * @returns The notice, or nothing once dismissed.
 */
export function Notice({ noticeId = 'formative-use' }: { readonly noticeId?: NoticeId }) {
  const locale = useLocale();
  const auth = useApiAuth();
  const titleId = useId();
  const version = NOTICE_VERSIONS[noticeId];
  const [state, setState] = useState<State>('loading');
  const region = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    void getMe(auth).then((result) => {
      if (!active) return;
      const dismissed =
        result.ok &&
        result.data.dismissedNotices.some(
          (notice) => notice.noticeId === noticeId && notice.version >= version,
        );
      setState(dismissed ? 'dismissed' : 'shown');
    });
    return () => {
      active = false;
    };
  }, [auth, noticeId, version]);

  if (state === 'loading' || state === 'dismissed') return null;

  const dismiss = async () => {
    const result = await dismissNotice(noticeId, version, auth);
    if (!result.ok) return setState('failed');
    // A11Y: WCAG 2.4.3: the focused button goes away with the notice; focus stays in the same part of the page.
    region.current?.closest<HTMLElement>(FOCUS_AFTER_DISMISS)?.focus({ preventScroll: true });
    setState('dismissed');
  };

  return (
    <section
      ref={region}
      aria-labelledby={titleId}
      className="mb-4 bg-hvl-feedback-info-bg p-4 text-hvl-feedback-info-fg"
    >
      <h2 id={titleId} className="text-hvl-feedback-info-fg">
        <span aria-hidden="true">{INFO_ICON} </span>
        {t('notice.formativeUse.title', locale)}
      </h2>
      <p className="mb-2">{t('notice.formativeUse.body', locale)}</p>
      {state === 'failed' ? <p role="alert">{t('notice.formativeUse.dismissFailed', locale)}</p> : null}
      <button type="button" className="button-primary" onClick={() => void dismiss()}>
        {t('notice.formativeUse.dismiss', locale)}
      </button>
    </section>
  );
}
