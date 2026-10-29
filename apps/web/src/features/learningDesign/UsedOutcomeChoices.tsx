/**
 * UsedOutcomeChoices — checkboxes with the learning outcomes the author already uses in the activity's course, to
 * add one to this activity with the very same words.
 *
 * Why: the planner's rows are distinct outcomes (D-088), so an outcome typed slightly differently in two activities
 *      would split into two rows. D-087 offers the outcomes already used for the same course code as checkboxes;
 *      ticking one adds it, unticking removes it again.
 * Spec: PED-030, PED-031, UD-006
 * Invariants:
 *   - Shown only for a valid course code with outcomes in use; the list is fetched again when the code changes, and
 *     a late answer for an earlier code is ignored.
 *   - A box is ticked when the form holds an outcome with the same identity (D-087); unticking removes every such
 *     outcome.
 *   - A11Y: while the form holds 20 outcomes, the group says so, and an unticked box stays in the Tab order, is
 *     marked `aria-disabled`, is described by that sentence and ignores a press (WCAG 3.3.2, 2.1.1), as
 *     ../mappe/MappeActivityPicker.tsx does at its limit.
 * Collaborators: ./LearningDesignPanel.tsx, ./learningDesignForm.ts, ./OutcomeFields.tsx (`CATEGORY_LABEL`),
 *   ../../api/learningDesignApi.ts.
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx, apps/web/test/features/UsedOutcomeChoices.test.tsx
 */
'use client';

import type { LearningOutcome } from '@hvl-interaktiv/api-contract';
import { useEffect, useId, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getCourseOutcomes } from '../../api/learningDesignApi';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { MAX_OUTCOMES, outcomeIdentity, type OutcomeDraft } from './learningDesignForm';
import { CATEGORY_LABEL } from './OutcomeFields';

/** What the choices need. */
export interface UsedOutcomeChoicesProps {
  /** The normalised course code, or undefined while the field holds none that is valid. */
  readonly courseCode: string | undefined;
  /** The outcomes in the form now. */
  readonly outcomes: readonly OutcomeDraft[];
  /** Adds (`true`) or removes (`false`) an outcome with this identity. */
  readonly onToggle: (outcome: LearningOutcome, add: boolean) => void;
}

/**
 * The checkboxes of outcomes already used in the course.
 * @param props - The course code, the form's outcomes and the toggle handler.
 * @returns A fieldset with one checkbox per outcome, or nothing.
 */
export function UsedOutcomeChoices({ courseCode, outcomes, onToggle }: UsedOutcomeChoicesProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const base = useId();
  const [used, setUsed] = useState<{
    readonly courseCode: string;
    readonly outcomes: readonly LearningOutcome[];
  }>();

  useEffect(() => {
    if (!courseCode) return;
    let active = true;
    void getCourseOutcomes(courseCode, auth).then((result) => {
      if (active && result.ok) setUsed({ courseCode, outcomes: result.data.outcomes });
    });
    return () => {
      active = false;
    };
  }, [courseCode, auth]);

  if (!courseCode || used?.courseCode !== courseCode || used.outcomes.length === 0) return null;
  const inForm = new Set(outcomes.map(outcomeIdentity));
  const full = outcomes.length >= MAX_OUTCOMES;
  return (
    <fieldset className="m-0 mb-4 border-0 p-0" aria-describedby={`${base}-hint`}>
      <legend className="mb-1 font-bold">
        {t('learningDesign.usedLegend', locale, { course: courseCode })}
      </legend>
      <p id={`${base}-hint`} className="m-0 text-hvl-ink-muted">
        {t('learningDesign.usedHint', locale)}
      </p>
      {full ? (
        <p id={`${base}-full`} className="m-0 font-bold">
          {t('learningDesign.outcomesFull', locale, { max: MAX_OUTCOMES })}
        </p>
      ) : null}
      {used.outcomes.map((outcome, index) => {
        const id = `${base}-${index}`;
        const checked = inForm.has(outcomeIdentity(outcome));
        const blocked = full && !checked;
        return (
          <div key={outcomeIdentity(outcome)} className="mt-1 flex items-start gap-2">
            <input
              type="checkbox"
              id={id}
              checked={checked}
              aria-disabled={blocked || undefined}
              aria-describedby={blocked ? `${base}-full` : undefined}
              onChange={(event) => {
                // WHY: a controlled box: ignoring the press keeps it unticked.
                if (!blocked) onToggle(outcome, event.target.checked);
              }}
              className="mt-1 min-h-target min-w-target"
            />
            <label htmlFor={id}>
              {t('learningDesign.usedOutcome', locale, {
                text: outcome.text,
                category: t(CATEGORY_LABEL[outcome.category], locale),
              })}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
