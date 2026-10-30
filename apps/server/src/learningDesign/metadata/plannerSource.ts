/**
 * plannerSource — reads the author's activities with one course code, with their phase and outcomes, for the
 * alignment planner.
 *
 * Why: the planner (PED-031, D-088) needs, for one course, the author's own and co-authored activities, drafts
 *      included, with what the grid places them by; ./plannerGrid.ts builds the grid from these without a database.
 * Spec: PED-031
 * Invariants:
 *   - Only the author's own and co-authored activities (./authorScope.ts) whose metadata has exactly this course code.
 *   - Of each activity only its ID, title, status, phase, outcomes and language tag are read; never its owner,
 *     co-authors, rationale or anything about learners.
 * Collaborators: ./LearningDesignStore.ts, ./plannerGrid.ts, ./authorScope.ts, ./learningDesignRecord.ts,
 *   ../../validation/activityLanguage.ts.
 * Tests: apps/server/test/learningDesign/metadata/plannerRoutes.int.test.ts
 */
import type { CourseCode } from '@hvl-interaktiv/api-contract';
import type { Database } from '../../infra/prismaClient.js';
import { activityLanguage } from '../../validation/activityLanguage.js';
import { authoredBy } from './authorScope.js';
import { contractOutcome } from './learningDesignRecord.js';
import type { PlannerSourceActivity } from './plannerGrid.js';

/**
 * The author's activities with a course code.
 * @param db - The database.
 * @param userId - The author's `User.id`.
 * @param courseCode - A normalised course code.
 * @returns The activities, with phase (when set), outcomes and language tag.
 * @spec PED-031
 */
export async function plannerActivities(
  db: Database,
  userId: string,
  courseCode: CourseCode,
): Promise<PlannerSourceActivity[]> {
  const rows = await db.h5PContent.findMany({
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
  });
  return rows.map((row) => {
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
}
