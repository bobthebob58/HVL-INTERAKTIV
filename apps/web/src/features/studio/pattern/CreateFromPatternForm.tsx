/**
 * CreateFromPatternForm — «Lag frå dette mønsteret» for a signed-in author: the activity's language, its content type
 * and phase when the pattern offers two, and an optional course code; it creates the draft and opens it on Rediger.
 *
 * Why: creating from a pattern is one server request that saves the skeleton and its learning-design metadata
 *      (PROD-001, D-085). The language defaults to the page's, the phase to the one the catalogue or planner carried
 *      (`?fase=`), and the course code to `?emne=` (D-088).
 * Spec: PROD-001, PED-030, UD-013
 * Invariants:
 *   - Sends only choices the pattern offers; the course code is normalised as the server does (D-087), and one that
 *     is not valid is reported on the field and in the error summary, without a request (WCAG 3.3.1, 3.3.3).
 *   - The request carries the session's CSRF token; a refusal shows the server's translated message in an alert.
 *   - The phase choice names phases by their content labels only (PED-001); without the labels it is not offered,
 *     and the form says the phase can be chosen on the Læringsdesign tab (the carried or first phase is sent).
 *   - Only the created activity's own ID is navigated to: `/aktivitet/<id>?fane=edit` (D-085).
 * Collaborators: ./CreateFromPattern.tsx, ../../../api/studioApi.ts, ../../../config/studioFilters.ts,
 *   ../../../config/paths.ts, ../../../components/ErrorSummary.tsx.
 * Tests: apps/web/test/features/PatternDetailView.test.tsx
 */
'use client';

import type { AuthorableContentType, PatternDetail, PhaseKey } from '@hvl-interaktiv/api-contract';
import { useId, useState, type FormEvent } from 'react';
import { createFromPattern } from '../../../api/studioApi';
import type { PortalSession } from '../../../api/portalSession';
import { ERROR_ICON, ErrorSummary, fieldErrorId } from '../../../components/ErrorSummary';
import { activityPath } from '../../../config/paths';
import { normaliseCourseCode } from '../../../config/studioFilters';
import { contentTypeName } from '../../../i18n/contentTypeName';
import { LOCALES, t, type Locale } from '../../../i18n/translate';
import { EDIT_TAB_ID } from '../../activity/tabs/EditTab';
import { ChoiceGroup, LANGUAGE_KEYS } from './ChoiceGroup';

/** What the form needs. */
export interface CreateFromPatternFormProps {
  readonly pattern: PatternDetail;
  readonly session: PortalSession;
  readonly locale: Locale;
  /** The phase and course the address carried, already checked. */
  readonly carried: { readonly phase?: PhaseKey; readonly course?: string };
  /** The phase labels, by key; undefined when they could not be loaded. */
  readonly phaseLabel: ((key: PhaseKey) => string) | undefined;
  readonly navigate: (path: string) => void;
}

/**
 * The create form.
 * @param props - The pattern, the session, the locale, the carried phase and course, and navigation.
 * @returns The form.
 */
export function CreateFromPatternForm({
  pattern,
  session,
  locale,
  carried,
  phaseLabel,
  navigate,
}: CreateFromPatternFormProps) {
  const id = useId();
  const courseId = `${id}-course`;
  const [language, setLanguage] = useState<Locale>(locale);
  const [contentType, setContentType] = useState<AuthorableContentType>(
    pattern.contentTypes[0] ?? 'H5P.QuestionSet',
  );
  const [phase, setPhase] = useState<PhaseKey | undefined>(
    carried.phase && pattern.phases.includes(carried.phase) ? carried.phase : pattern.phases[0],
  );
  const [course, setCourse] = useState(carried.course ?? '');
  const [state, setState] = useState<
    { status: 'idle' | 'busy' | 'invalid' } | { status: 'failed'; message: string }
  >({ status: 'idle' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // WHY: one draft per press; a second press while the first request runs would create a second activity.
    if (state.status === 'busy') return;
    const courseCode = course.trim() === '' ? undefined : normaliseCourseCode(course);
    if (course.trim() !== '' && !courseCode) return setState({ status: 'invalid' });
    setState({ status: 'busy' });
    const result = await createFromPattern(
      pattern.id,
      {
        language,
        ...(pattern.phases.length > 1 && phase ? { phase } : {}),
        ...(pattern.contentTypes.length > 1 ? { contentType } : {}),
        ...(courseCode ? { courseCode } : {}),
      },
      { kind: 'portal', csrfToken: session.csrfToken },
    );
    if (result.ok) return navigate(activityPath(result.data.contentId, EDIT_TAB_ID));
    setState({ status: 'failed', message: result.error?.message ?? t('common.loadFailed', locale) });
  };

  const invalid = state.status === 'invalid';
  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      {invalid ? (
        <ErrorSummary
          key={course}
          errors={[{ fieldId: courseId, message: t('patterns.courseCodeInvalid', locale) }]}
        />
      ) : null}
      <div className="mb-4">
        <label htmlFor={`${id}-language`} className="block font-bold">
          {t('patterns.language', locale)}
        </label>
        <select
          id={`${id}-language`}
          className="block min-h-6 rounded border border-hvl-ink-muted bg-hvl-surface px-2 py-1 text-hvl-ink"
          value={language}
          onChange={(event) => setLanguage(LOCALES.find((code) => code === event.target.value) ?? locale)}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {t(LANGUAGE_KEYS[code], locale)}
            </option>
          ))}
        </select>
      </div>
      {pattern.contentTypes.length > 1 ? (
        <ChoiceGroup
          legend={t('patterns.contentType', locale)}
          values={pattern.contentTypes}
          value={contentType}
          onChange={setContentType}
          label={(type) => contentTypeName(type, locale)}
        />
      ) : null}
      {pattern.phases.length > 1 && phase && phaseLabel ? (
        <ChoiceGroup
          legend={t('patterns.phase', locale)}
          values={pattern.phases}
          value={phase}
          onChange={setPhase}
          label={phaseLabel}
        />
      ) : null}
      {pattern.phases.length > 1 && !phaseLabel ? <p>{t('patterns.phaseLater', locale)}</p> : null}
      <div className="mb-4">
        <label htmlFor={courseId} className="block font-bold">
          {t('patterns.courseCode', locale)}
        </label>
        <p id={`${courseId}-hint`} className="m-0 text-hvl-ink-muted">
          {t('patterns.courseCodeHint', locale)}
        </p>
        {invalid ? (
          <p id={fieldErrorId(courseId)} className="m-0 font-bold text-hvl-feedback-incorrect-fg">
            <span aria-hidden="true">{ERROR_ICON} </span>
            {t('patterns.courseCodeInvalid', locale)}
          </p>
        ) : null}
        <input
          id={courseId}
          className="block min-h-6 rounded border border-hvl-ink-muted bg-hvl-surface px-2 py-1 text-hvl-ink"
          value={course}
          onChange={(event) => setCourse(event.target.value)}
          aria-describedby={[`${courseId}-hint`, ...(invalid ? [fieldErrorId(courseId)] : [])].join(' ')}
          aria-invalid={invalid || undefined}
          autoComplete="off"
        />
      </div>
      {state.status === 'failed' ? (
        <p role="alert">
          {t('patterns.createFailed', locale)} {state.message}
        </p>
      ) : null}
      <button type="submit" className="button-primary" aria-disabled={state.status === 'busy' || undefined}>
        {state.status === 'busy' ? t('patterns.creating', locale) : t('patterns.submit', locale)}
      </button>
    </form>
  );
}
