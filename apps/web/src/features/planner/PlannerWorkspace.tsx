/**
 * PlannerWorkspace — the alignment planner for a signed-in author: the course chooser and, for the course in the
 * address, the gaps, the outcomes × phases table and the activities that lack tags.
 *
 * Why: PED-031 plans one course at a time (D-088). The course is in the address (`?emne=`), read in the browser
 *      after the session answered, so a plan can be shared; the phase labels come from content (PED-001).
 * Spec: PED-031, PED-001
 * Invariants:
 *   - The course is read with the studio's address rules (../../config/studioFilters.ts): an invalid `?emne=` counts
 *     as none, and the chooser asks for a course.
 *   - The table needs the phase labels; without the course codes, the overview or the planner the workspace says
 *     it could not load. The overview and the planner are fetched only for a chosen course.
 *   - Only the author's own and co-authored activities appear: the server decides (D-088).
 * Collaborators: ./PlannerView.tsx, ./PlannerCourseChooser.tsx, ./PlannerTable.tsx, ./PlannerGaps.tsx,
 *   ./PlannerUntagged.tsx, ../../api/learningDesignApi.ts, ../../api/studioApi.ts (`getStudioOverview`).
 * Tests: apps/web/test/features/PlannerView.test.tsx
 */
'use client';

import type { PhaseKey, Planner, StudioOverview } from '@hvl-interaktiv/api-contract';
import { useEffect, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getCourseCodes, getPlanner } from '../../api/learningDesignApi';
import { getStudioOverview } from '../../api/studioApi';
import { readStudioFilters } from '../../config/studioFilters';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { PlannerCourseChooser } from './PlannerCourseChooser';
import { PlannerGaps } from './PlannerGaps';
import { PlannerTable } from './PlannerTable';
import { PlannerUntagged } from './PlannerUntagged';

type Loaded<T> = T | 'loading' | 'failed';

/** The course in the page's address, if valid. */
const addressCourse = (): string | undefined =>
  readStudioFilters(new URLSearchParams(window.location.search)).course;

/**
 * The planner for a signed-in author.
 * @param props - How to open another address (the browser's own navigation by default).
 * @returns The chooser and, for a chosen course, the plan.
 */
export function PlannerWorkspace({ navigate }: { readonly navigate: (path: string) => void }) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [course] = useState(addressCourse);
  const [codes, setCodes] = useState<Loaded<readonly string[]>>('loading');
  const [overview, setOverview] = useState<Loaded<StudioOverview>>('loading');
  const [planner, setPlanner] = useState<Loaded<Planner>>('loading');

  useEffect(() => {
    let active = true;
    void getCourseCodes(auth).then((result) => active && setCodes(result.ok ? result.data.inUse : 'failed'));
    if (course) {
      void getStudioOverview(auth).then(
        (result) => active && setOverview(result.ok ? result.data : 'failed'),
      );
      void getPlanner(course, auth).then(
        (result) => active && setPlanner(result.ok ? result.data : 'failed'),
      );
    }
    return () => {
      active = false;
    };
  }, [auth, course]);

  if (codes === 'loading') return <p role="status">{t('common.loading', locale)}</p>;
  if (codes === 'failed') return <p role="alert">{t('common.loadFailed', locale)}</p>;
  const chooser = <PlannerCourseChooser courseCodes={codes} current={course} navigate={navigate} />;
  if (!course)
    return (
      <>
        {chooser}
        {codes.length > 0 ? <p>{t('planner.chooseCourse', locale)}</p> : null}
      </>
    );
  if (planner === 'loading' || overview === 'loading')
    return (
      <>
        {chooser}
        <p role="status">{t('common.loading', locale)}</p>
      </>
    );
  if (planner === 'failed' || overview === 'failed')
    return (
      <>
        {chooser}
        <p role="alert">{t('common.loadFailed', locale)}</p>
      </>
    );

  const labels = new Map(overview.phases.map((phase) => [phase.key, phase.label[locale]]));
  const phaseLabel = (phase: PhaseKey): string => labels.get(phase) ?? phase;
  return (
    <>
      {chooser}
      <PlannerGaps gaps={planner.gaps} phaseLabel={phaseLabel} />
      {planner.rows.length > 0 ? (
        <>
          <p>{t('planner.scrollHint', locale)}</p>
          <PlannerTable planner={planner} phaseLabel={phaseLabel} />
        </>
      ) : (
        <p>{t('planner.noRows', locale, { course: planner.courseCode })}</p>
      )}
      <PlannerUntagged courseCode={planner.courseCode} untagged={planner.untagged} />
    </>
  );
}
