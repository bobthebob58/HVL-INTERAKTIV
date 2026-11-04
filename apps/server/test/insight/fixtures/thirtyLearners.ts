/**
 * thirtyLearners — synthetic stored xAPI rows of 30 learners (L01–L30) for the insight fixture: the QuestionSet in one
 * Canvas course, the InteractiveVideo in the same course, and rows the view must leave out (another version, another
 * course, the portal, before the period). The expected values are worked out by hand in ./README.md.
 *
 * Why: INS-001's acceptance is "numbers match a hand-calculated fixture of 30 synthetic learners". The rows follow
 *      what H5P really sends (apps/server/test/fixtures/xapi/, probe P1) and what D-115 stores: a root `attempted`
 *      per page load, a part's `answered` with its `subContentId`, a root `completed` as the QuestionSet's result.
 * Spec: INS-001, INS-002, INS-003, INS-005
 * Tests: apps/server/test/insight/thirtyLearners.test.ts, apps/server/test/insight/videoLearners.test.ts,
 *   apps/server/test/insight/insightService.int.test.ts
 */
import { IV1, IV2, IV3, Q1, Q2, Q3 } from './insightActivities.js';

/** A stored row as the fixture writes it; the test adds the activity, version and context. */
export interface FixtureRow {
  readonly learnerKey: string;
  readonly attemptId: string;
  readonly subContentId: string | null;
  readonly verb: 'attempted' | 'answered' | 'completed';
  readonly scoreRaw: number | null;
  readonly scoreMax: number | null;
  readonly success: boolean | null;
  readonly response: string | null;
  readonly timestamp: Date;
}

/** When the view is computed: Wednesday 4 November 2026, 13:00 in Oslo. */
export const FIXTURE_NOW = new Date('2026-11-04T12:00:00.000Z');
/** Midnight Oslo time (CET) on 28 October 2026: the start of the 7-day view. */
export const PERIOD_START = new Date('2026-10-27T23:00:00.000Z');

const MINUTE = 60_000;
/** The learner key of L01–L30 (and of noise learners outside the 30). */
export const learnerKey = (n: number): string => `fixture-learner-${String(n).padStart(2, '0')}`;
const viewId = (n: number, view: number): string =>
  `00000000-0000-4000-8000-${String(n * 100 + view).padStart(12, '0')}`;
const baseOf = (n: number): number => Date.parse('2026-11-02T08:00:00.000Z') + (n - 1) * 15 * MINUTE;

type Step = [
  minute: number,
  verb: FixtureRow['verb'],
  item: string | null,
  score: [number, number] | null,
  success: boolean | null,
  response: string | null,
  attempt: number,
];

/** The rows of one page load. */
function pageLoad(n: number, view: number, start: number, steps: readonly Step[]): FixtureRow[] {
  return steps.map(([minute, verb, item, score, success, response, attempt]) => ({
    learnerKey: learnerKey(n),
    attemptId: `${viewId(n, view)}:${attempt}`,
    subContentId: item,
    verb,
    scoreRaw: score?.[0] ?? null,
    scoreMax: score?.[1] ?? null,
    success,
    response,
    timestamp: new Date(start + minute * MINUTE),
  }));
}

const RIGHT: Step[] = [
  [0, 'attempted', null, null, null, null, 1],
  [1, 'answered', Q1, [1, 1], true, '0', 1],
  [2, 'answered', Q2, [2, 2], null, 'uthenting[,]spreidd', 1],
  [3, 'answered', Q3, [2, 2], null, 'samling[,]forarbeid', 1],
];
const B_FIRST: Step[] = [
  [0, 'attempted', null, null, null, null, 1],
  [1, 'answered', Q1, [0, 1], false, '1', 1],
  [2, 'answered', Q2, [1, 2], null, 'henting[,]spredt', 1],
  [3, 'answered', Q3, [0, 2], null, 'forarbeid[,]samling', 1],
];
const retry = (from: number, attempt: number): Step[] => [
  [from, 'answered', Q1, [1, 1], true, '0', attempt],
  [from + 1, 'answered', Q2, [2, 2], null, 'uthenting[,]spredt', attempt],
  [from + 2, 'answered', Q3, [2, 2], null, 'samling[,]forarbeid', attempt],
];
const done = (minute: number, raw: number, attempt: number): Step => [
  minute,
  'completed',
  null,
  [raw, 5],
  raw >= 3,
  null,
  attempt,
];

/** The QuestionSet's rows inside the view: groups A–E of README.md (F is in `questionSetNoise`). */
export function questionSetRows(): FixtureRow[] {
  const rows: FixtureRow[] = [];
  [6, 7, 8, 8, 9, 10, 10, 11, 12, 12, 13, 14].forEach((minutes, i) =>
    rows.push(...pageLoad(i + 1, 1, baseOf(i + 1), [...RIGHT, done(minutes, 5, 1)])),
  );
  [15, 16, 18, 20, 21, 22].forEach((minutes, i) =>
    rows.push(
      ...pageLoad(i + 13, 1, baseOf(i + 13), [
        ...B_FIRST,
        done(4, 1, 1),
        ...retry(5, 2),
        done(minutes, 5, 2),
      ]),
    ),
  );
  // L19 and L20 retry after a reload: their time is the sum of two page loads (10 + 12 and 14 + 16 minutes).
  [
    [19, 10, 12],
    [20, 14, 16],
  ].forEach(([n = 0, first = 0, second = 0]) => {
    rows.push(...pageLoad(n, 1, baseOf(n), [...B_FIRST, done(first, 1, 1)]));
    rows.push(
      ...pageLoad(n, 2, baseOf(n) + 60 * MINUTE, [
        [0, 'attempted', null, null, null, null, 1],
        ...retry(5, 1),
        done(second, 5, 1),
      ]),
    );
  });
  [4, 5, 6].forEach((minutes, i) =>
    rows.push(
      ...pageLoad(i + 21, 1, baseOf(i + 21), [
        [0, 'attempted', null, null, null, null, 1],
        [1, 'answered', Q1, [0, 1], false, '2', 1],
        [minutes, 'answered', Q2, [0, 2], null, ' Henting [,]', 1],
      ]),
    ),
  );
  [9, 10, 11].forEach((minutes, i) =>
    rows.push(
      ...pageLoad(i + 24, 1, baseOf(i + 24), [
        [0, 'attempted', null, null, null, null, 1],
        [1, 'answered', Q1, [0, 1], false, '3', 1],
        [2, 'answered', Q2, [2, 2], null, 'UTHENTING[,]spreidd', 1],
        [3, 'answered', Q3, [1, 2], null, 'samling[,]etterarbeid', 1],
        done(minutes, 3, 1),
      ]),
    ),
  );
  // L27 opens it at exactly the period's start (included); L28 opens it and leaves.
  rows.push(...pageLoad(27, 1, PERIOD_START.getTime(), [[0, 'attempted', null, null, null, null, 1]]));
  rows.push(...pageLoad(28, 1, baseOf(28), [[0, 'attempted', null, null, null, null, 1]]));
  return rows;
}

/** Where a noise row was stored: the same activity, but outside the view. */
export type NoisePlace = 'beforePeriod' | 'version1' | 'otherCourse' | 'portal';

/** QuestionSet rows the 7-day view of version 2 in course A must leave out. */
export function questionSetNoise(): { readonly place: NoisePlace; readonly rows: FixtureRow[] }[] {
  const early = Date.parse('2026-10-20T08:00:00.000Z');
  return [
    // Group F: L29 and L30 played before the period only. L01 also opened it 30 minutes before Oslo midnight.
    {
      place: 'beforePeriod',
      rows: [29, 30].flatMap((n) => pageLoad(n, 1, early + n * MINUTE, [...RIGHT, done(5, 5, 1)])),
    },
    { place: 'beforePeriod', rows: pageLoad(1, 9, PERIOD_START.getTime() - 30 * MINUTE, [...B_FIRST]) },
    { place: 'version1', rows: pageLoad(2, 8, baseOf(2) - 120 * MINUTE, [...B_FIRST, done(4, 1, 1)]) },
    { place: 'otherCourse', rows: pageLoad(5, 7, baseOf(5), [...B_FIRST, done(4, 1, 1)]) },
    { place: 'portal', rows: pageLoad(10, 6, baseOf(10), [...B_FIRST, done(4, 1, 1)]) },
  ];
}

/** The InteractiveVideo's rows of L01–L20 (README.md, the video table). */
export function videoRows(): FixtureRow[] {
  const choice = (n: number): [string, boolean] =>
    n <= 12 ? ['0', true] : n <= 17 ? ['1', false] : ['2', false];
  return Array.from({ length: 20 }, (_, i) => i + 1).flatMap((n) => {
    const [response, right] = choice(n);
    const iv1: Step = [n <= 9 ? 1 : 3, 'answered', IV1, [right ? 1 : 0, 1], right, response, 1];
    const iv2: Step = [n <= 3 ? 4 : 6, 'answered', IV2, [n <= 4 ? 1 : 0, 1], n <= 4, null, 1];
    const iv3: Step = [8, 'answered', IV3, [2, 2], null, 'uthenting[,]spreidd', 1];
    const steps: Step[] = [[0, 'attempted', null, null, null, null, 1]];
    if (n <= 18) steps.push(iv1);
    if (n <= 9) steps.push(iv2);
    if (n <= 3) steps.push(iv3);
    return pageLoad(n, 3, baseOf(n) + 5 * 60 * MINUTE, steps);
  });
}
