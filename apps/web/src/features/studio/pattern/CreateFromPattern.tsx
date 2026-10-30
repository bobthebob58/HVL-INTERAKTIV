/**
 * CreateFromPattern — the «Lag frå dette mønsteret» section of a pattern's page, in each state of the visitor: signed
 * out (the login link back to this page), a learner (a short explanation), a pattern that cannot be created now (why),
 * or a signed-in author (the form).
 *
 * Why: the pattern page is public (D-089), but creating is for portal authors (D-085); the server checks again on the
 *      request. Each state says in words what the visitor can do, so nobody meets a form they cannot use.
 * Spec: PROD-001, AUTH-001, AUTH-003
 * Invariants:
 *   - The session is asked only here, in the browser (D-068); the rest of the page never depends on it.
 *   - The login link returns to this page with its query, so a carried phase and course survive the login.
 *   - An unavailable pattern shows no form (D-085: creating would answer 409).
 * Collaborators: ../PatternDetailView.tsx, ./CreateFromPatternForm.tsx, ../../../api/usePortalSession.ts,
 *   ../../../components/LoginPrompt.tsx.
 * Tests: apps/web/test/features/PatternDetailView.test.tsx
 */
'use client';

import type { PatternDetail } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { isAuthor } from '../../../api/portalSession';
import { usePortalSession } from '../../../api/usePortalSession';
import { LoginPrompt } from '../../../components/LoginPrompt';
import { t } from '../../../i18n/translate';
import { CreateFromPatternForm, type CreateFromPatternFormProps } from './CreateFromPatternForm';

/** What the section needs: the form's inputs without the session, and where the login returns to. */
export type CreateFromPatternProps = Omit<CreateFromPatternFormProps, 'session'> & {
  readonly pattern: PatternDetail;
  readonly returnTo: string;
};

/**
 * The create section.
 * @param props - The pattern, the locale, the carried phase and course, navigation and the login's return path.
 * @returns The section with the state's content.
 */
export function CreateFromPattern({ returnTo, ...props }: CreateFromPatternProps) {
  const { locale, pattern } = props;
  const headingId = useId();
  const state = usePortalSession();
  const content = (() => {
    if (state.status === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
    if (state.status === 'error') return <p role="alert">{t('common.loadFailed', locale)}</p>;
    if (state.status === 'signedOut')
      return <LoginPrompt locale={locale} message={t('patterns.signedOut', locale)} returnTo={returnTo} />;
    if (!isAuthor(state.session)) return <p>{t('patterns.notAuthor', locale)}</p>;
    if (!pattern.available) return <p>{t('patterns.unavailable', locale)}</p>;
    return (
      <>
        <p>{t('patterns.createIntro', locale)}</p>
        <CreateFromPatternForm session={state.session} {...props} />
      </>
    );
  })();
  return (
    <section aria-labelledby={headingId} className="mt-8 rounded bg-hvl-surface p-4 text-hvl-ink">
      <h2 id={headingId}>{t('patterns.createHeading', locale)}</h2>
      {content}
    </section>
  );
}
