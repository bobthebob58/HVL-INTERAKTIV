/**
 * busyCourse — a course of the run author with one more activity than a planner holds, so the accessibility suites
 * see the planner's note about the activities it does not show.
 *
 * Why: a planner holds the 300 most recently changed activities of a course and says so when there are more
 *      (D-128). The seed's own course has three; the note is checked on a course of its own, so the seed's plan
 *      keeps the gaps the other suites check.
 * Spec: UD-030, PED-031
 * Invariants:
 *   - Made once per server: copies of the seed's designed activity, as drafts with this course's code and a phase.
 *   - Every copy is owned by the run author, so ../../test/support/appTestbed.ts's cleanup removes them.
 * Collaborators: ./studioViews.ts (`studioSeedOf`), ../../test/support/realWebApp.ts.
 * Tests: apps/server/a11y/axeStudioViews.a11y.test.ts
 */
import { randomUUID } from 'node:crypto';
import { PLANNER_MAX_ACTIVITIES } from '@hvl-interaktiv/api-contract';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import { studioSeedOf } from './studioViews.js';

/** The course code of the busy course (D-087's form). */
export const BUSY_COURSE = 'UU-A11Y-900';

const seeded = new WeakSet<RealWebApp>();

/**
 * Makes the busy course on a server, once.
 * @param app - The running server, with the studio seed in place.
 * @returns The course code, for the planner's `?emne=`.
 */
export async function busyCourse(app: RealWebApp): Promise<string> {
  if (seeded.has(app)) return BUSY_COURSE;
  seeded.add(app);
  const db = app.tb.db;
  const row = await db.h5PContent.findUniqueOrThrow({ where: { id: studioSeedOf(app).designedId } });
  const ids = Array.from({ length: PLANNER_MAX_ACTIVITIES + 1 }, () => randomUUID());
  // WHY: `as never`: a read row's JSON columns have the output type, which `createMany` takes at run time.
  const copies = ids.map((id, n) => ({
    ...row,
    id,
    title: `Øving ${String(n + 1)}`,
    status: 'draft',
    publishedAt: null,
    bankListedAt: null,
  }));
  await db.h5PContent.createMany({ data: copies as never });
  await db.learningDesignMetadata.createMany({
    data: ids.map((contentId) => ({ contentId, courseCode: BUSY_COURSE, phase: 'underveis' as const })),
  });
  return BUSY_COURSE;
}
