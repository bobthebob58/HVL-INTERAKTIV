/**
 * plannerSource — reads the author's activities with one course code, with their phase and outcomes, for the
 * alignment planner.
 *
 * Why: the planner (PED-031, D-088) needs, for one course, the author's own and co-authored activities, drafts
 *      included, with what the grid places them by; ./plannerGrid.ts builds the grid from these without a database.
 * Spec: PED-031
 * Invariants:
 *   - Only the author's own and co-authored activities (./authorScope.ts) whose metadata has exactly this course code.
 *   - At most `PLANNER_MAX_ACTIVITIES` of them, the most recently changed, and whether the course has more: one
 *     planner reads a bounded number of rows however many activities a course has (D-128).
 *   - Of each activity only its ID, title, status, phase, outcomes and language tag are read; never its owner,
 *     co-authors, rationale or anything about learners.
 * Collaborators: ./LearningDesignStore.ts, ./plannerGrid.ts, ./authorScope.ts, ./learningDesignRecord.ts,
 *   ../../validation/activityLanguage.ts.
 * Tests: apps/server/test/learningDesign/metadata/plannerRoutes.int.test.ts
 */
import { PLANNER_MAX_ACTIVITIES, type CourseCode } from '@hvl-interaktiv/api-contract';
import type { Database } from '../../infra/prismaClient.js';
import { activityLanguage } from '../../validation/activityLanguage.js';
import { authoredBy } from './authorScope.js';
import { contractOutcome } from './learningDesignRecord.js';
import type { PlannerSourceActivity } from './plannerGrid.js';

/** What the planner of one course is built from. */
export interface PlannerSource {
  /** The activities, with phase (when set), outcomes and language tag. */
  readonly activities: PlannerSourceActivity[];
  /** True when the course has more activities of the author than `activities` holds. */
  readonly more: boolean;
}

/**
 * The author's activities with a course code: the most recently changed, up to the planner's limit.
 * @param db - The database.
 * @param userId - The author's `User.id`.
 * @param courseCode - A normalised course code.
 * @returns The activities and whether there are more.
 * @spec PED-031
 */
export async function plannerActivities(
  db: Database,
  userId: string,
  courseCode: CourseCode,
): Promise<PlannerSource> {
  const found = await db.h5PContent.findMany({
    where: { ...authoredBy(userId), learningDesign: { is: { courseCode } } },
    select: {
      id: true,
      title: true,
      status: true,
      metadata: true,
      learningDesign: {
        select: {
          phase: true,
          outcomes: { select: { text: true, category: true }, orderBy: { position: 'asc' } },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    // WHY: one more than the planner holds tells whether there are more, without counting them.
    take: PLANNER_MAX_ACTIVITIES + 1,
  });
  const rows = found.slice(0, PLANNER_MAX_ACTIVITIES);
  const activities = rows.map((row): PlannerSourceActivity => {
    const language = activityLanguage(row.metadata);
    const phase = row.learningDesign?.phase;
    return {
      contentId: row.id,
      title: row.title,
      status: row.status,
      ...(language ? { language } : {}),
      ...(phase ? { phase } : {}),
      outcomes: (row.learningDesign?.outcomes ?? []).map(contractOutcome),
    };
  });
  return { activities, more: found.length > PLANNER_MAX_ACTIVITIES };
}
