/**
 * LearningDesignFormView — the **Læringsdesign** tab's form for one stored version of the metadata: phase, course
 * code, learning outcomes (with those already used in the course), rationale, student minutes and the learner
 * purpose, saved as one full replace.
 *
 * Why: PED-030 tags each activity, and D-087 makes the save a full replace guarded by the `updatedAt` the form was
 *      made from, so a colleague's save in the meantime is never overwritten without notice.
 * Spec: PED-030, PED-032, UD-013, UD-006
 * Invariants:
 *   - Every field is optional; invalid input is listed in an error summary linked to its fields (WCAG 3.3.1) and
 *     nothing is sent. The server checks every limit again.
 *   - A stale `updatedAt` (409 `hvl:learning-design-conflict`) keeps what the author typed and says so in plain
 *     language, with a button that loads what is stored instead (`onLoadStored`).
 *   - Saving and saved are said in a status region next to the button (WCAG 4.1.3), also the second time; after a
 *     save the form shows the stored values with the same inputs (focus stays), and `onSaved` is told.
 *   - One request at a time: while saving, the button is `aria-disabled` (it keeps focus) and presses do nothing.
 * Collaborators: ./LearningDesignPanel.tsx (mounts it once per stored version), ./learningDesignForm.ts,
 *   ./PhaseField.tsx, ./CourseCodeField.tsx, ./OutcomeFields.tsx, ./UsedOutcomeChoices.tsx, ./CountedField.tsx,
 *   ./MinutesField.tsx, ./SaveProblem.tsx, ../../api/learningDesignApi.ts.
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx, apps/web/test/features/OutcomeFields.test.tsx
 */
'use client';

import type { LearningDesign, LearningOutcome, StudioOverview } from '@hvl-interaktiv/api-contract';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { replaceLearningDesign } from '../../api/learningDesignApi';
import { ErrorSummary, type FieldError } from '../../components/ErrorSummary';
import { useAnnouncement } from '../../components/useAnnouncement';
import { normaliseCourseCode } from '../../config/studioFilters';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { CountedField } from './CountedField';
import { CourseCodeField } from './CourseCodeField';
import {
  formFrom,
  formProblems,
  outcomeIdentity,
  PURPOSE_MAX,
  RATIONALE_MAX,
  updateFrom,
} from './learningDesignForm';
import type { FormFieldIds, LearningDesignForm } from './learningDesignForm';
import { MinutesField } from './MinutesField';
import { OutcomeFields } from './OutcomeFields';
import { PhaseField } from './PhaseField';
import { SaveProblem, type SaveProblemKind } from './SaveProblem';
import { UsedOutcomeChoices } from './UsedOutcomeChoices';

/** What the form needs. */
export interface LearningDesignFormViewProps {
  readonly contentId: string;
  /** The stored version the form starts from. */
  readonly design: LearningDesign;
  readonly overview: StudioOverview | 'loading' | 'failed';
  readonly courseCodes: readonly string[];
  /** The `lang` of the learner purpose: the activity's language when it differs from the page's. */
  readonly purposeLang?: string;
  /** Says something in the page's polite status region. */
  readonly announce: (message: string) => void;
  /** The save is stored. */
  readonly onSaved: (design: LearningDesign) => void;
  /** After a conflict: load what is stored, giving up what was typed. */
  readonly onLoadStored: () => void;
}

/**
 * The form.
 * @param props - The activity, the stored version, the phase labels, the course codes and the handlers.
 * @returns The form with its error summary, fields, status and save button.
 */
export function LearningDesignFormView(props: LearningDesignFormViewProps) {
  const { contentId, design, overview, courseCodes, purposeLang, announce, onSaved, onLoadStored } = props;
  const locale = useLocale();
  const auth = useApiAuth();
  const base = useId();
  const keys = useRef(0);
  const [values, setValues] = useState<LearningDesignForm>(() => formFrom(design));
  const [updatedAt, setUpdatedAt] = useState(design.updatedAt);
  const [errors, setErrors] = useState<{ readonly attempt: number; readonly list: readonly FieldError[] }>({
    attempt: 0,
    list: [],
  });
  const [problem, setProblem] = useState<SaveProblemKind>();
  const [status, say] = useAnnouncement();
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const ids: FormFieldIds = {
    courseCode: `${base}-course`,
    rationale: `${base}-rationale`,
    minutes: `${base}-minutes`,
    purpose: `${base}-purpose`,
    outcome: (key) => `${base}-outcome-${key}`,
  };
  const newKey = () => `n${(keys.current += 1)}`;
  const set = (change: Partial<LearningDesignForm>) => setValues((current) => ({ ...current, ...change }));
  const fieldErrors = new Map(errors.list.map((error) => [error.fieldId, error.message]));
  const outcomeErrors = new Map(
    values.outcomes.flatMap((o) => {
      const message = fieldErrors.get(ids.outcome(o.key));
      return message ? [[o.key, message] as const] : [];
    }),
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    const list = formProblems(values, ids, locale);
    setErrors({ attempt: errors.attempt + 1, list });
    setProblem(undefined);
    if (list.length > 0) return;
    busy.current = true;
    setSaving(true);
    say(t('learningDesign.saving', locale));
    const result = await replaceLearningDesign(contentId, updateFrom(values, updatedAt), auth);
    busy.current = false;
    setSaving(false);
    if (result.ok) {
      // WHY: the stored (normalised) values, under the keys the inputs had, so React keeps them and their focus.
      setValues(formFrom(result.data, (index) => values.outcomes[index]?.key ?? `s${index}`));
      setUpdatedAt(result.data.updatedAt);
      say(t('learningDesign.saved', locale));
      onSaved(result.data);
      return;
    }
    say('');
    if (result.error?.errorCode === 'hvl:learning-design-conflict') setProblem('conflict');
    else setProblem({ message: result.error?.message ?? t('learningDesign.saveFailed', locale) });
  };
  const toggleUsed = (outcome: LearningOutcome, add: boolean) =>
    set({
      outcomes: add
        ? [...values.outcomes, { ...outcome, key: newKey() }]
        : values.outcomes.filter((o) => outcomeIdentity(o) !== outcomeIdentity(outcome)),
    });

  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      {errors.list.length > 0 ? <ErrorSummary key={errors.attempt} errors={errors.list} /> : null}
      {problem ? <SaveProblem problem={problem} onLoadStored={onLoadStored} /> : null}
      <PhaseField overview={overview} value={values.phase} onChange={(phase) => set({ phase })} />
      <CourseCodeField
        id={ids.courseCode}
        value={values.courseCode}
        onChange={(courseCode) => set({ courseCode })}
        suggestions={courseCodes}
        error={fieldErrors.get(ids.courseCode)}
      />
      <OutcomeFields
        outcomes={values.outcomes}
        onChange={(outcomes) => set({ outcomes })}
        newKey={newKey}
        fieldId={ids.outcome}
        errors={outcomeErrors}
        announce={announce}
      />
      <UsedOutcomeChoices
        courseCode={normaliseCourseCode(values.courseCode)}
        outcomes={values.outcomes}
        onToggle={toggleUsed}
      />
      <CountedField
        id={ids.rationale}
        label={t('learningDesign.rationaleLabel', locale)}
        hint={t('learningDesign.rationaleHint', locale)}
        value={values.rationale}
        onChange={(rationale) => set({ rationale })}
        max={RATIONALE_MAX}
        multiline
        error={fieldErrors.get(ids.rationale)}
      />
      <MinutesField
        id={ids.minutes}
        value={values.minutes}
        onChange={(minutes) => set({ minutes })}
        error={fieldErrors.get(ids.minutes)}
      />
      <CountedField
        id={ids.purpose}
        label={t('learningDesign.purposeLabel', locale)}
        hint={t('learningDesign.purposeHint', locale)}
        value={values.purpose}
        onChange={(purpose) => set({ purpose })}
        max={PURPOSE_MAX}
        error={fieldErrors.get(ids.purpose)}
        lang={purposeLang}
      />
      <p role="status" className="min-h-6">
        {status}
      </p>
      <button type="submit" className="button-primary" aria-disabled={saving || undefined}>
        {t('learningDesign.save', locale)}
      </button>
    </form>
  );
}
