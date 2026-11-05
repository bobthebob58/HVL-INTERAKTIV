/**
 * purgeFixtureRows — the stored xAPI statements of the yearly purge's fixture: 25 of the ended year E (course X version
 * 1 with six learners and hand-worked figures and Canvas's test student, two portal learners, a third portal learner
 * stored on 1 August of E + 1 with E's key, three learners of version 2, and the test student alone in version 3) and
 * 2 of the current year.
 *
 * Why: the snapshots must equal the mappe's figures for the year (D-107 amendment of 2026-11-04): in course X, version
 *      1, six learners started; L1–L5 have two root results each (L5's second a root `answered`, which counts as one,
 *      D-115) with first and last scores 4→8, 5→7, 2→6 (stored last result first, so only the time order gives it),
 *      6→6 and 3→9 of 10, so the participants are 6, the median attempts 2, the mean change +32 points, and the rate
 *      (5 of 6) is hidden by the two-sided rule; the portal (2 learners in autumn E, 1 in autumn E + 1) and version 2
 *      (3) stay below k = 5.
 *      The row stored on 1 August of E + 1 with year E is the portal session across the turn of the year (D-057): the
 *      purge takes it by its stored year, not its time.
 * Spec: DATA-003, MAPPE-003
 * Tests: apps/server/test/privacy/purge/retentionPurge.int.test.ts (through ./purgeFixture.ts)
 */
import { randomUUID } from 'node:crypto';

/** One statement as `createMany` takes it. */
interface StatementRow {
  readonly id: string;
  readonly contentId: string;
  readonly subContentId: string | null;
  readonly contentVersion: number;
  readonly contextId: string | null;
  readonly learnerKey: string;
  readonly verb: string;
  readonly scoreRaw: number | null;
  readonly scoreMax: number | null;
  readonly scaled: number | null;
  readonly attemptId: string;
  readonly timestamp: Date;
  readonly academicYear: number;
  readonly testUser: boolean;
}

/** A statement of the fixture before it gets its activity, key and time. */
interface Planned {
  readonly learner: string;
  readonly verb: 'attempted' | 'answered' | 'completed';
  readonly course: string | null;
  readonly score?: number;
  readonly subContentId?: string;
  readonly version?: number;
  /** When it was stored; autumn of E, a minute after the one before, when omitted. */
  readonly at?: Date;
  /** The stored year; E when omitted. */
  readonly year?: number;
  /** Canvas's Student View test student (D-102's amendment of 2026-11-04). */
  readonly testUser?: boolean;
}

/**
 * The fixture's statements.
 * @param contentId - The activity.
 * @param course - Course X as `<platformId>:X`.
 * @param ended - The ended year E.
 * @param key - Makes a learner's key unique to the run.
 * @returns 27 rows: 25 of E and 2 of E + 1.
 */
export function fixtureStatements(
  contentId: string,
  course: string,
  ended: number,
  key: (name: string) => string,
): StatementRow[] {
  const current = ended + 1;
  const changes: [string, number, number][] = [
    ['L1', 4, 8],
    ['L2', 5, 7],
    ['L4', 6, 6],
    ['L5', 3, 9],
  ];
  const autumn = Date.UTC(ended, 9, 1, 8);
  const hours = (count: number) => new Date(autumn + count * 3_600_000);
  const planned: Planned[] = [
    ...['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].map((learner) => ({
      learner,
      verb: 'attempted' as const,
      course,
    })),
    ...changes.flatMap(([learner, first, last]) => [
      { learner, verb: 'completed' as const, course, score: first },
      // WHY: a root `answered` is a root result too (D-115), so a snapshot that read only `completed` would differ.
      {
        learner,
        verb: learner === 'L5' ? ('answered' as const) : ('completed' as const),
        course,
        score: last,
      },
    ]),
    // WHY: L3's 2→6 is stored last result first, so a snapshot that read results in storage order saw 6→2.
    { learner: 'L3', verb: 'completed', course, score: 6, at: hours(2) },
    { learner: 'L3', verb: 'completed', course, score: 2, at: hours(1) },
    { learner: 'L6', verb: 'answered', course, subContentId: 'q1' },
    // WHY: deleted with its year, but in no snapshot: the test student is in no aggregate (D-102 amendment).
    { learner: 'T1', verb: 'completed', course, score: 0, testUser: true },
    // WHY: a teacher's Student View play of a version no learner has played yet: no snapshot, in a dry run's count too.
    { learner: 'T1', verb: 'attempted', course, version: 3, testUser: true },
    { learner: 'P1', verb: 'completed', course: null, score: 10 },
    { learner: 'P2', verb: 'completed', course: null, score: 10 },
    // WHY: 05:00 in Oslo on 1 August of E + 1, with E's key: a portal session made on 31 July (D-057).
    { learner: 'P3', verb: 'attempted', course: null, at: new Date(Date.UTC(current, 7, 1, 3)) },
    ...['V1', 'V2', 'V3'].map((learner) => ({
      learner,
      verb: 'completed' as const,
      course,
      score: 10,
      version: 2,
    })),
    { learner: 'N1', verb: 'attempted', course, at: new Date(Date.UTC(current, 7, 15, 8)), year: current },
    {
      learner: 'N1',
      verb: 'completed',
      course,
      score: 7,
      at: new Date(Date.UTC(current, 7, 15, 9)),
      year: current,
    },
  ];
  return planned.map((row, i) => ({
    id: randomUUID(),
    contentId,
    subContentId: row.subContentId ?? null,
    contentVersion: row.version ?? 1,
    contextId: row.course,
    learnerKey: key(row.learner),
    verb: row.verb,
    scoreRaw: row.score ?? null,
    scoreMax: row.score === undefined ? null : 10,
    scaled: row.score === undefined ? null : row.score / 10,
    attemptId: `${randomUUID()}:1`,
    timestamp: row.at ?? new Date(autumn + i * 60_000),
    academicYear: row.year ?? ended,
    testUser: row.testUser ?? false,
  }));
}
