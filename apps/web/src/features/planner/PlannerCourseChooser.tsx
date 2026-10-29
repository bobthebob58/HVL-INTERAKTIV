/**
 * PlannerCourseChooser — the planner's choice of course: a select of the author's course codes and a button that
 * opens the planner for the chosen one.
 *
 * Why: D-088 plans one course at a time, chosen from the codes in the author's own and co-authored activities. The
 *      course goes into the address (`?emne=`), so a plan can be shared and reloaded (PED-031).
 * Spec: PED-031, UD-013
 * Invariants:
 *   - Offers the author's codes in use, plus the address's course when it is not one of them, so the select always
 *     shows the plan on screen.
 *   - Without any code the chooser says how to add one, on the **Læringsdesign** tab.
 *   - Choosing changes nothing until the button is pressed (WCAG 3.2.2).
 * Collaborators: ./PlannerWorkspace.tsx, ../../config/paths.ts (`plannerHref`).
 * Tests: apps/web/test/features/PlannerView.test.tsx
 */
'use client';

import { useId, useState, type FormEvent } from 'react';
import { plannerHref } from '../../config/paths';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/** What the chooser needs. */
export interface PlannerCourseChooserProps {
  /** The author's course codes in use, sorted. */
  readonly courseCodes: readonly string[];
  /** The course in the address, if any. */
  readonly current?: string;
  /** Opens an address (the browser's own navigation in the page). */
  readonly navigate: (path: string) => void;
}

/**
 * The course chooser.
 * @param props - The codes, the current course and the navigation.
 * @returns A small form, or the sentence saying no activity has a course code yet.
 */
export function PlannerCourseChooser({ courseCodes, current, navigate }: PlannerCourseChooserProps) {
  const locale = useLocale();
  const id = useId();
  const codes = current && !courseCodes.includes(current) ? [current, ...courseCodes] : courseCodes;
  const [chosen, setChosen] = useState(current ?? codes[0] ?? '');
  if (codes.length === 0) return <p>{t('planner.courseNone', locale)}</p>;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (chosen) navigate(plannerHref(chosen));
  };
  return (
    <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={id} className="block font-bold">
          {t('planner.courseLabel', locale)}
        </label>
        <select
          id={id}
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
          className="min-h-target rounded border-2 border-hvl-ink-muted bg-hvl-surface p-1"
        >
          {codes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="button-primary">
        {t('planner.courseShow', locale)}
      </button>
    </form>
  );
}
