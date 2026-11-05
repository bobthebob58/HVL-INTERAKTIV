/**
 * storedResultsFixture — stored xAPI rows for the pedagogisk mappe's real results source: one activity whose counted
 * groups hold 17 learner places with hand-worked figures, beside groups below *k* that must not count; one activity
 * whose only group has 4 learners; and one whose second version would reveal the first's hidden completers.
 *
 * Why: MAPPE-003's Verify is "a 4-learner fixture asserts suppression"; with S6's stored results (D-095) the figures
 *      must come through the real query and the group rules (course, version, semester; D-103, PROD-013, D-106).
 *      Hand-worked for the large activity, over the groups of at least 5 (course A and course C, version 1, autumn
 *      2026), each learner counted once per group as insight's views count them: 17 participants (L01–L12 in A, and
 *      L07–L11 again in C); completed 11 of 17 (A's L01–L06 and C's five), so 65 %; the completers' attempts 2, 2, 2,
 *      2, 2, 1 in A and 2, 2, 2, 2, 2 in C, so the median is 2; the five learners with two scored results (all in A)
 *      change by +40, +20, +40, 0 and +60 points, a mean of +32. Left out: course B (4 learners, all at full marks),
 *      the portal (3), version 2 (4), and spring 2026 in course A (L01 at 0 % and one other learner). In the split
 *      activity insight shows version 2's 9 completers of 15 and hides version 1's 2 of 12, so the mappe shows its 27
 *      participants and hides the rate and the median, which would give those 2 away.
 * Spec: MAPPE-003, MAPPE-002
 * Tests: apps/server/test/learningDesign/mappe/storedActivityResults.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { Database } from '../../../src/infra/prismaClient.js';
import { academicYearOf } from '../../../src/privacy/academicYear.js';

/** A course of the fixture as `XapiStatement.contextId` stores it (D-103), or null for the portal. */
type Course = string | null;

/** One stored statement as the fixture describes it. */
interface Row {
  readonly learner: string;
  readonly verb: 'attempted' | 'answered' | 'completed';
  readonly course: Course;
  /** Score out of 10 for a root result; omitted for no score. */
  readonly score?: number;
  readonly subContentId?: string;
  readonly version?: number;
  /** When it was stored; autumn 2026 when omitted. */
  readonly at?: Date;
  /** Canvas's Student View test student (D-102's amendment of 2026-11-04); a real learner when omitted. */
  readonly testUser?: boolean;
  /** The year of the learner's key; the academic year of the stored time when omitted (D-107, D-057). */
  readonly academicYear?: number;
}

/** The learner keys of the fixture, each unique to the run and recognisable in an export. */
export const fixtureLearnerKey = (run: string, learner: string): string => `mappe-learner-${run}-${learner}`;

const range = (prefix: string, from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, '0')}`);

/** The large activity's rows: the counted groups first, then the groups that must not count. */
export function largeActivityRows(courses: { a: string; b: string; c: string }): Row[] {
  const changes: [string, number, number][] = [
    ['L01', 4, 8],
    ['L02', 5, 7],
    ['L03', 2, 6],
    ['L04', 6, 6],
    ['L05', 3, 9],
  ];
  const spring = new Date('2026-04-15T10:00:00.000Z');
  return [
    ...range('L', 1, 12).map((learner) => ({ learner, verb: 'attempted' as const, course: courses.a })),
    ...changes.flatMap(([learner, first, last]) => [
      { learner, verb: 'completed' as const, course: courses.a, score: first },
      { learner, verb: 'completed' as const, course: courses.a, score: last },
    ]),
    { learner: 'L06', verb: 'completed', course: courses.a, score: 9 },
    ...range('L', 7, 12).map((learner) => ({
      learner,
      verb: 'answered' as const,
      course: courses.a,
      subContentId: 'q1',
    })),
    ...range('L', 7, 11).flatMap((learner) => [
      { learner, verb: 'attempted' as const, course: courses.c },
      { learner, verb: 'completed' as const, course: courses.c },
      { learner, verb: 'completed' as const, course: courses.c },
    ]),
    ...range('B', 1, 4).map((learner) => ({
      learner,
      verb: 'completed' as const,
      course: courses.b,
      score: 10,
    })),
    ...range('P', 1, 3).map((learner) => ({ learner, verb: 'completed' as const, course: null, score: 10 })),
    ...range('V', 1, 4).map((learner) => ({
      learner,
      verb: 'completed' as const,
      course: courses.a,
      score: 10,
      version: 2,
    })),
    { learner: 'L01', verb: 'completed', course: courses.a, score: 0, at: spring },
    { learner: 'S01', verb: 'attempted', course: courses.a, at: spring },
  ];
}

/** The small activity's rows: four learners in one course, all completed. */
export function smallActivityRows(course: string): Row[] {
  return range('M', 1, 4).map((learner) => ({ learner, verb: 'completed' as const, course, score: 7 }));
}

/** The split activity's rows: version 1 with 2 of 12 completed, version 2 with 9 of 15, in one course. */
export function splitActivityRows(course: string): Row[] {
  const version = (prefix: string, number: number, learners: number, completers: number): Row[] =>
    range(prefix, 1, learners).map((learner, n) => ({
      learner,
      verb: n < completers ? ('completed' as const) : ('attempted' as const),
      course,
      version: number,
      ...(n < completers ? { score: 5 } : {}),
    }));
  return [...version('X', 1, 12, 2), ...version('Y', 2, 15, 9)];
}

/**
 * Stores rows for an activity, one minute apart in the given order, in autumn 2026 unless a row says otherwise.
 * @param db - The test database.
 * @param run - The run's name, part of every learner key.
 * @param contentId - The activity.
 * @param rows - The rows.
 * @returns When the rows are stored.
 */
export async function storeRows(
  db: Database,
  run: string,
  contentId: string,
  rows: readonly Row[],
): Promise<void> {
  const autumn = Date.parse('2026-10-01T08:00:00.000Z');
  await db.xapiStatement.createMany({
    data: rows.map((row, i) => ({
      id: randomUUID(),
      contentId,
      contentVersion: row.version ?? 1,
      contextId: row.course,
      learnerKey: fixtureLearnerKey(run, row.learner),
      subContentId: row.subContentId ?? null,
      verb: row.verb,
      scoreRaw: row.score ?? null,
      scoreMax: row.score === undefined ? null : 10,
      scaled: row.score === undefined ? null : row.score / 10,
      attemptId: `${randomUUID()}:1`,
      timestamp: new Date((row.at?.getTime() ?? autumn) + i * 60_000),
      academicYear: row.academicYear ?? academicYearOf(row.at ?? new Date(autumn)),
      testUser: row.testUser ?? false,
    })),
  });
}
