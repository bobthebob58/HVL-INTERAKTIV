/**
 * Tests for the pedagogisk mappe's learner summaries from stored statements: only groups (course, version, semester)
 * of at least *k* learners count, a learner counts once in each such group with that group's results only, and
 * attempts, completion and scores are read as D-115 says (the root results; first and last scores only with two or
 * more).
 *
 * Spec: MAPPE-003, INS-006
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  learnerSummaries,
  type LearnerPresence,
  type LearnerRootResult,
} from '../../../src/learningDesign/mappe/learnerSummaries.js';
import { semesterStartOf } from '../../../src/learningDesign/mappe/resultSemesters.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';

const k5 = minimumGroupSize(5);
const QUIZ = '0192f0c4-0000-7000-8000-00000000000a';
const COURSE_A = 'platform-1:A';
/** Midnight Oslo time on 1 August 2026, and on 1 January 2026. */
const AUTUMN = new Date('2026-07-31T22:00:00.000Z');
const SPRING = new Date('2025-12-31T23:00:00.000Z');
const IN_AUTUMN = Date.parse('2026-10-01T08:00:00.000Z');

type Place = Partial<Omit<LearnerPresence, 'learner'>>;
const presence = (learner: string, place: Place = {}): LearnerPresence => ({
  contentId: QUIZ,
  contextId: COURSE_A,
  contentVersion: 1,
  semesterStart: AUTUMN,
  learner,
  ...place,
});
const group = (prefix: string, count: number, place: Place = {}) =>
  Array.from({ length: count }, (_, n) => presence(`${prefix}${n + 1}`, place));
let clock = IN_AUTUMN;
const result = (
  learner: string,
  scaled: number | null,
  rest: Partial<LearnerRootResult> = {},
): LearnerRootResult => ({
  contentId: QUIZ,
  contextId: COURSE_A,
  contentVersion: 1,
  learner,
  subContentId: null,
  verb: 'completed',
  scoreMax: scaled === null ? 0 : 10,
  scaled,
  timestamp: new Date((clock += 60_000)),
  ...rest,
});

describe('[MAPPE-003] learner summaries from groups of at least k', () => {
  it('[MAPPE-003] leaves out each group below k: another course, the portal, another version, another semester', () => {
    // Arrange
    const presences = [
      ...group('a', 5),
      ...group('b', 4, { contextId: 'platform-1:B' }),
      ...group('p', 4, { contextId: null }),
      ...group('v', 4, { contentVersion: 2 }),
      ...group('s', 4, { semesterStart: SPRING }),
      ...group('o', 4, { contentId: '0192f0c4-0000-7000-8000-00000000000b' }),
    ];
    // Act
    const summaries = learnerSummaries(k5, presences, []);
    // Assert
    expect([...summaries.keys()]).toEqual([QUIZ]);
    expect(summaries.get(QUIZ)).toHaveLength(5);
  });

  it('[MAPPE-003] counts a learner once in each group of at least k with its own results, never in a smaller one', () => {
    // Arrange: a1–a5 are in course A and in course C (5 learners each); a1 also played in B (2 learners).
    const presences = [...group('a', 5), ...group('a', 5, { contextId: 'platform-1:C' })];
    presences.push(...['a1', 'b9'].map((learner) => presence(learner, { contextId: 'platform-1:B' })));
    const results = [
      result('a1', 0, { contextId: 'platform-1:B' }),
      result('a1', 0.5),
      result('a1', 0.6),
      result('a1', 0.7, { contextId: 'platform-1:C' }),
    ];
    // Act
    const summaries = learnerSummaries(k5, presences, results).get(QUIZ) ?? [];
    // Assert: one summary per learner and group, as insight's two course views count them.
    expect(summaries).toHaveLength(10);
    expect(new Set(summaries.map((summary) => summary.group))).toEqual(new Set([0, 1]));
    expect(summaries.filter((summary) => summary.completed)).toEqual([
      { group: 0, attempts: 2, completed: true, firstScore: 0.5, lastScore: 0.6 },
      { group: 1, attempts: 1, completed: true, firstScore: null, lastScore: null },
    ]);
  });

  it('[MAPPE-003] reads attempts, completion and the first and last scores as D-115 does', () => {
    // Arrange
    const results = [
      result('a1', 0.2),
      result('a1', null, { verb: 'answered', subContentId: 'q1', scoreMax: 1, scaled: 1 }),
      result('a1', 0.6, { verb: 'answered' }),
      result('a1', null),
      result('a2', 0.9),
      result('a4', null, { verb: 'attempted' }),
      result('stranger', 0.4),
      result('stranger', 0.8),
    ];
    // Act
    const summaries = learnerSummaries(k5, group('a', 5), results).get(QUIZ) ?? [];
    // Assert
    expect(summaries).toEqual([
      { group: 0, attempts: 3, completed: true, firstScore: 0.2, lastScore: 0.6 },
      { group: 0, attempts: 1, completed: true, firstScore: null, lastScore: null },
      { group: 0, attempts: 0, completed: false, firstScore: null, lastScore: null },
      { group: 0, attempts: 0, completed: false, firstScore: null, lastScore: null },
      { group: 0, attempts: 0, completed: false, firstScore: null, lastScore: null },
    ]);
  });

  it('[MAPPE-003] puts a result in the semester of its Oslo date, so one from 31 July is not autumn’s', () => {
    // Arrange: a1 played on 31 July at 23:30 and on 1 August at 00:30, Oslo time; spring's group has 1 learner.
    const presences = [...group('a', 5), presence('a1', { semesterStart: SPRING })];
    const results = [
      result('a1', 0.1, { timestamp: new Date('2026-07-31T21:30:00.000Z') }),
      result('a1', 0.3, { timestamp: new Date('2026-07-31T22:30:00.000Z') }),
      result('a1', 0.4),
    ];
    // Act
    const summaries = learnerSummaries(k5, presences, results).get(QUIZ) ?? [];
    // Assert
    expect(summaries[0]).toEqual({ group: 0, attempts: 2, completed: true, firstScore: 0.3, lastScore: 0.4 });
  });

  it('[MAPPE-003] whatever is stored, every summary is of a learner in a group of at least k, once per group', () => {
    const play = fc.record({
      learner: fc.integer({ min: 1, max: 12 }).map((n) => `l${n}`),
      contextId: fc.constantFrom(COURSE_A, 'platform-1:B', null),
      contentVersion: fc.integer({ min: 1, max: 2 }),
      timestamp: fc.date({
        min: new Date('2026-05-01T00:00:00Z'),
        max: new Date('2026-09-30T00:00:00Z'),
        noInvalidDate: true,
      }),
      scaled: fc.option(fc.double({ min: 0, max: 1, noNaN: true })),
    });
    fc.assert(
      fc.property(fc.array(play, { maxLength: 80 }), (plays) => {
        // Arrange
        const rows = plays.map((p) => ({
          ...p,
          contentId: QUIZ,
          semesterStart: semesterStartOf(p.timestamp),
        }));
        const keyOf = (row: (typeof rows)[number]) =>
          JSON.stringify([row.contextId, row.contentVersion, row.semesterStart.getTime()]);
        const members = new Map<string, Set<string>>();
        for (const row of rows)
          members.set(keyOf(row), (members.get(keyOf(row)) ?? new Set()).add(row.learner));
        const inKept = rows.filter((row) => (members.get(keyOf(row))?.size ?? 0) >= 5);
        const results = rows.map((row) => result(row.learner, row.scaled, { ...row }));
        // Act
        const summaries = learnerSummaries(k5, rows, results).get(QUIZ) ?? [];
        // Assert
        expect(summaries).toHaveLength(new Set(inKept.map((row) => `${keyOf(row)}|${row.learner}`)).size);
        expect(summaries.reduce((sum, { attempts }) => sum + attempts, 0)).toBe(inKept.length);
        const kept = new Set(inKept.map(keyOf));
        const sizes = [...new Set(summaries.map(({ group: g }) => g))].map(
          (g) => summaries.filter((summary) => summary.group === g).length,
        );
        expect(sizes.sort()).toEqual([...kept].map((key) => members.get(key)?.size ?? 0).sort());
      }),
    );
  });
});
