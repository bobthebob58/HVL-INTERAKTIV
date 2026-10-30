/**
 * plannerGrid — builds the alignment planner of one course from the author's activities with that course code: the
 * outcomes × phases grid, the gaps and the activities that lack tags.
 *
 * Why: PED-031 shows, for one course, which outcomes each phase serves and where the gaps are. D-088 fixes the model;
 *      keeping it a pure function lets a test prove the order, the cells and both gap rules without a database.
 * Spec: PED-031
 * Invariants:
 *   - Columns are the phases in content order (`phases`), each once; every row has one cell per column, in order.
 *   - Rows are the distinct outcomes (D-087) of every activity with the course code, ordered by category and then
 *     text; an activity with several outcomes appears in each of their rows, in the column of its phase.
 *   - An activity without a phase is in no cell; without a phase or without outcomes it is listed in `untagged`,
 *     saying which is missing (D-088). Its outcomes still give rows, so an outcome is never hidden.
 *   - Gaps: each row without an `etterarbeid` activity (in row order), then each phase without any activity (in
 *     column order).
 *   - Activities are ordered by title (Norwegian order), then ID; drafts are included and keep their status.
 * Collaborators: ./LearningDesignStore.ts, ./plannerSource.ts, ./outcomeIdentity.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/metadata/plannerGrid.test.ts
 */
import type {
  LearningOutcome,
  PhaseKey,
  Planner,
  PlannerActivity,
  PlannerGap,
  PlannerUntagged,
} from '@hvl-interaktiv/api-contract';
import { compareNorwegian, distinctOutcomes, outcomeKey } from './outcomeIdentity.js';

/** The phase whose absence for an outcome is a gap (D-088). */
export const CONSOLIDATION_PHASE: PhaseKey = 'etterarbeid';

/** One of the author's activities with the course code, as the planner reads it. */
export interface PlannerSourceActivity extends PlannerActivity {
  /** Absent while the activity has no phase. */
  readonly phase?: PhaseKey;
  readonly outcomes: readonly LearningOutcome[];
}

const reference = ({ contentId, title, status, language }: PlannerSourceActivity): PlannerActivity => ({
  contentId,
  title,
  status,
  ...(language ? { language } : {}),
});

const byTitle = (a: PlannerSourceActivity, b: PlannerSourceActivity): number =>
  compareNorwegian(a.title, b.title) || (a.contentId < b.contentId ? -1 : a.contentId > b.contentId ? 1 : 0);

const untaggedEntry = (activity: PlannerSourceActivity): PlannerUntagged[] => {
  const missing = [
    ...(activity.phase ? [] : (['phase'] as const)),
    ...(activity.outcomes.length > 0 ? [] : (['outcomes'] as const)),
  ];
  return missing.length > 0 ? [{ ...reference(activity), missing }] : [];
};

/**
 * Builds the planner for one course.
 * @param courseCode - The normalised course code.
 * @param phases - Every phase key once, in content order (`content.phases`).
 * @param activities - The author's own and co-authored activities with that course code, in any order.
 * @returns The planner answer.
 * @spec PED-031
 */
export function buildPlanner(
  courseCode: string,
  phases: readonly PhaseKey[],
  activities: readonly PlannerSourceActivity[],
): Planner {
  const sorted = [...activities].sort(byTitle);
  const keysOf = new Map(sorted.map((activity) => [activity, new Set(activity.outcomes.map(outcomeKey))]));
  const rows = distinctOutcomes(sorted.flatMap((activity) => activity.outcomes)).map((outcome) => {
    const key = outcomeKey(outcome);
    const cells = phases.map((phase) => ({
      phase,
      activities: sorted
        .filter((activity) => activity.phase === phase && keysOf.get(activity)?.has(key))
        .map(reference),
    }));
    return { outcome, cells };
  });
  const gaps: PlannerGap[] = [
    ...rows
      .filter(
        (row) => !row.cells.some((cell) => cell.phase === CONSOLIDATION_PHASE && cell.activities.length > 0),
      )
      .map((row) => ({ kind: 'no-etterarbeid' as const, outcome: row.outcome })),
    ...phases
      .filter((phase) => !sorted.some((activity) => activity.phase === phase))
      .map((phase) => ({ kind: 'empty-phase' as const, phase })),
  ];
  return { courseCode, phases: [...phases], rows, gaps, untagged: sorted.flatMap(untaggedEntry) };
}
