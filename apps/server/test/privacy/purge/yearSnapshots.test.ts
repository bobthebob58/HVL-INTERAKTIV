/**
 * Unit tests for the yearly purge's snapshots (D-107 and its amendment of 2026-11-04): one per context and version,
 * with the mappe's hand-worked figures and nothing a group below *k* would give away; plus the CLI's arguments and
 * which configured secrets a completed purge makes stale.
 *
 * Spec: DATA-003, MAPPE-003, INS-006
 */
import { describe, expect, it } from 'vitest';
import type {
  LearnerPresence,
  LearnerRootResult,
} from '../../../src/learningDesign/mappe/learnerSummaries.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { staleSecretYears } from '../../../src/privacy/purge/purgeAudit.js';
import { parsePurgeArgs } from '../../../src/privacy/purge/purgeCli.js';
import { SNAPSHOT_SOURCE, yearSnapshotRows } from '../../../src/privacy/purge/yearSnapshots.js';

const CONTENT = '0196f000-0000-7000-8000-000000000001';
const COURSE = '0196f000-0000-7000-8000-0000000000aa:X';
const AUTUMN_2010 = new Date('2010-07-31T22:00:00.000Z');
const k5 = minimumGroupSize(5);

const presence = (learner: string, contextId: string | null, contentVersion = 1): LearnerPresence => ({
  contentId: CONTENT,
  contextId,
  contentVersion,
  learner,
  semesterStart: AUTUMN_2010,
});

const result = (learner: string, score: number, minute: number): LearnerRootResult => ({
  contentId: CONTENT,
  contextId: COURSE,
  contentVersion: 1,
  learner,
  subContentId: null,
  verb: 'completed',
  scoreMax: 10,
  scaled: score / 10,
  timestamp: new Date(Date.UTC(2010, 9, 1, 8, minute)),
});

/** Course X, version 1: six learners; L1–L5 completed twice (first and last score), L6 only started. */
const changes: [string, number, number][] = [
  ['L1', 4, 8],
  ['L2', 5, 7],
  ['L3', 2, 6],
  ['L4', 6, 6],
  ['L5', 3, 9],
];
const rows = {
  presences: [
    ...['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].map((learner) => presence(learner, COURSE)),
    presence('P1', null),
    presence('P2', null),
    ...['V1', 'V2', 'V3'].map((learner) => presence(learner, COURSE, 2)),
  ],
  results: changes.flatMap(([learner, first, last], i) => [
    result(learner, first, i * 2),
    result(learner, last, i * 2 + 1),
  ]),
};

describe('[DATA-003] the yearly purge’s snapshots', () => {
  it('[DATA-003] writes one snapshot per context and version, the portal first, for the academic year', () => {
    // Act
    const snapshots = yearSnapshotRows(k5, 2010, CONTENT, rows);
    // Assert
    expect(snapshots.map((row) => [row.contextId, row.contentVersion])).toEqual([
      [null, 1],
      [COURSE, 1],
      [COURSE, 2],
    ]);
    expect(snapshots.every((row) => row.k === 5 && row.contentId === CONTENT)).toBe(true);
    expect(snapshots[0]?.periodStart).toEqual(new Date('2010-07-31T22:00:00.000Z'));
    expect(snapshots[0]?.periodEnd).toEqual(new Date('2011-07-31T22:00:00.000Z'));
  });

  it('[MAPPE-003] keeps the mappe’s hand-worked figures and hides the 5-of-6 rate by the two-sided rule', () => {
    // Act
    const course = yearSnapshotRows(k5, 2010, CONTENT, rows)[1];
    // Assert: participants 6; attempts 2 each; changes +40, +20, +40, 0, +60 points, a mean of +32 (D-095).
    expect(course?.aggregates).toEqual({
      source: SNAPSHOT_SOURCE,
      academicYear: 2010,
      suppressed: false,
      participants: 6,
      medianAttempts: 2,
      changePoints: expect.closeTo(32, 9) as number,
    });
  });

  it('[INS-006] keeps nothing but «suppressed» for a place whose groups are all below k', () => {
    // Act
    const [portal, , version2] = yearSnapshotRows(k5, 2010, CONTENT, rows);
    // Assert
    for (const snapshot of [portal, version2]) {
      expect(snapshot?.aggregates).toEqual({ source: SNAPSHOT_SOURCE, academicYear: 2010, suppressed: true });
    }
  });

  it('[INS-006] uses the configured k: with k = 7, the six learners of course X are too few as well', () => {
    // Act
    const snapshots = yearSnapshotRows(minimumGroupSize(7), 2010, CONTENT, rows);
    // Assert
    expect(snapshots.map((row) => [row.k, row.aggregates.suppressed])).toEqual([
      [7, true],
      [7, true],
      [7, true],
    ]);
  });

  it('[DATA-003] writes nothing for an activity without rows in the year', () => {
    expect(yearSnapshotRows(k5, 2010, CONTENT, { presences: [], results: [] })).toEqual([]);
  });
});

describe('[DATA-003] the purge CLI and the secrets left to destroy', () => {
  it.each([
    [['--dry-run'], 'dry-run'],
    [['--execute'], 'execute'],
    [[], 'usage'],
    [['--dry-run', '--execute'], 'usage'],
    [['--force'], 'usage'],
  ] as const)('[DATA-003] reads %j as %s', (argv, mode) => {
    expect(parsePurgeArgs(argv)).toBe(mode);
  });

  it('[DATA-003] names every configured secret up to the latest purged year, and none before a purge', () => {
    // Act and assert
    expect(staleSecretYears([2011, 2009, 2010, 2012], 2010)).toEqual([2009, 2010]);
    expect(staleSecretYears(new Map([[2026, Buffer.alloc(32)]]).keys(), undefined)).toEqual([]);
  });
});
