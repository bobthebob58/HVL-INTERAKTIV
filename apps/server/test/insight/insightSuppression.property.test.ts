/**
 * Property tests of INS-006 (fast-check, D-114): for random datasets and any k from 3, no insight report or CSV row
 * shows a group smaller than k, no hidden value can be worked out from a total, and no free-text answer fewer than k
 * learners gave appears.
 *
 * Spec: INS-006, INS-003, INS-009
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { insightCsvRows } from '../../src/insight/export/insightCsvRows.js';
import { additiveGroupCells } from '../../src/insight/suppression/additiveGroupCells.js';
import { minimumGroupSize } from '../../src/privacy/minimumGroupSize.js';
import { INTERACTIVE_VIDEO, IV1, IV2, IV3, Q1, Q2, QUESTION_SET } from './fixtures/insightActivities.js';
import type { FixtureRow } from './fixtures/thirtyLearners.js';
import { cellsIn, insightInvariantViolations } from './support/reportInvariants.js';
import { reportOf } from './support/insightFixtureReport.js';

/** The CSV measures that are counts of learners (the others are shares and medians). */
const COUNTS = new Set([
  'started',
  'completed',
  'courseLearners',
  'learners',
  'rightOption',
  'wrongOption',
  'noAnswer',
  'gapCorrect',
  'wrongAnswer',
  'otherWrong',
  'empty',
  'answered',
]);
const WORDS = ['uthenting', ' Uthenting ', 'henting', 'HENTING', '', 'spreidd', 'spredt', 'feil'];
const learnerPlay = fc.record({
  opened: fc.boolean(),
  q1: fc.array(fc.integer({ min: -1, max: 4 }), { maxLength: 3 }),
  q2: fc.array(fc.tuple(fc.constantFrom(...WORDS), fc.constantFrom(...WORDS)), { maxLength: 2 }),
  results: fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 2 }),
  video: fc.array(fc.constantFrom(IV1, IV2, IV3), { maxLength: 3 }),
});
type Play = typeof learnerPlay extends fc.Arbitrary<infer T> ? T : never;
const dataset = fc.record({
  k: fc.integer({ min: 3, max: 7 }),
  courseLearners: fc.option(fc.integer({ min: 0, max: 60 }), { nil: undefined }),
  learners: fc.array(learnerPlay, { maxLength: 45 }),
});

/** The rows of one learner's play, one page load, a minute apart. */
function rowsOf(n: number, play: Play, activity: 'questionSet' | 'video'): FixtureRow[] {
  const steps: Omit<FixtureRow, 'learnerKey' | 'attemptId' | 'timestamp'>[] = [];
  const row = (verb: FixtureRow['verb'], subContentId: string | null, rest: Partial<FixtureRow> = {}) =>
    steps.push({
      verb,
      subContentId,
      scoreRaw: null,
      scoreMax: null,
      success: null,
      response: null,
      ...rest,
    });
  if (play.opened) row('attempted', null);
  if (activity === 'video') {
    play.video.forEach((item, i) =>
      row('answered', item, { scoreRaw: i % 2, scoreMax: 1, success: i % 2 === 1, response: '0' }),
    );
  } else {
    play.q1.forEach((option) =>
      row('answered', Q1, {
        scoreRaw: option === 0 ? 1 : 0,
        scoreMax: 1,
        success: option === 0,
        response: option < 0 ? '' : String(option),
      }),
    );
    play.q2.forEach(([a, b]) => row('answered', Q2, { scoreRaw: 1, scoreMax: 2, response: `${a}[,]${b}` }));
    play.results.forEach((raw) => row('completed', null, { scoreRaw: raw, scoreMax: 5 }));
  }
  return steps.map((step, i) => ({
    ...step,
    learnerKey: `property-learner-${n}`,
    attemptId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}:1`,
    timestamp: new Date(Date.UTC(2026, 10, 2, 8, n, i)),
  }));
}

/** How many learners' first answer to a gap folds to each text. */
function firstGapAnswers(learners: readonly Play[], gap: 0 | 1): Map<string, number> {
  const counts = new Map<string, number>();
  for (const play of learners) {
    const first = play.q2[0]?.[gap].trim().toLowerCase();
    if (first) counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  return counts;
}

describe('[INS-006] suppression properties', () => {
  it('[INS-006] for random datasets no output contains a group smaller than k and no hidden value can be derived from totals', () => {
    fc.assert(
      fc.property(dataset, ({ k, courseLearners, learners }) => {
        // Arrange
        const size = minimumGroupSize(k);
        const rows = learners.flatMap((play, n) => rowsOf(n, play, 'questionSet'));
        const videoRows = learners.flatMap((play, n) => rowsOf(n, play, 'video'));
        // Act
        const reports = [
          reportOf(QUESTION_SET, rows, { size, courseLearners }),
          reportOf(INTERACTIVE_VIDEO, videoRows, { size, courseLearners }),
        ];
        // Assert
        for (const report of reports) {
          expect(insightInvariantViolations(report)).toEqual([]);
          expect(JSON.stringify(report)).not.toContain('property-learner');
        }
      }),
    );
  });

  it('[INS-003] for random datasets a wrong gap answer is listed only when k learners gave it first', () => {
    fc.assert(
      fc.property(dataset, ({ k, learners }) => {
        // Arrange
        const rows = learners.flatMap((play, n) => rowsOf(n, play, 'questionSet'));
        // Act
        const report = reportOf(QUESTION_SET, rows, { size: minimumGroupSize(k) });
        // Assert
        const q2 = report.misconceptions.find(({ item }) => item === Q2);
        for (const gap of q2?.kind === 'gaps' ? q2.gaps : []) {
          const given = firstGapAnswers(learners, gap.index as 0 | 1);
          for (const { answer } of gap.wrongAnswers) expect(given.get(answer) ?? 0).toBeGreaterThanOrEqual(k);
        }
      }),
    );
  });

  it('[INS-009] for random datasets the CSV rows carry «< k» for each suppressed cell and no count below k', () => {
    fc.assert(
      fc.property(dataset, ({ k, courseLearners, learners }) => {
        // Arrange
        const rows = learners.flatMap((play, n) => rowsOf(n, play, 'questionSet'));
        const report = reportOf(QUESTION_SET, rows, { size: minimumGroupSize(k), courseLearners });
        // Act
        const csv = insightCsvRows(report);
        // Assert
        const hidden = cellsIn(report).filter((cell) => cell.suppressed).length;
        expect(csv.filter(({ value }) => value === `< ${k}`)).toHaveLength(hidden);
        for (const { value } of csv.filter(
          ({ measure, value }) => COUNTS.has(measure) && value !== `< ${k}`,
        )) {
          expect(value === '' || value === '0' || Number(value) >= k).toBe(true);
        }
      }),
    );
  });

  it('[INS-006] for random additive groups exactly one hidden cell never remains, and a small total hides all', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
        fc.array(fc.nat({ max: 12 }), { minLength: 1, maxLength: 8 }),
        (k, counts) => {
          // Arrange
          const total = counts.reduce((sum, count) => sum + count, 0);
          // Act
          const cells = additiveGroupCells(minimumGroupSize(k), total, counts);
          // Assert
          const hidden = cells.filter((cell) => cell.suppressed);
          const shownSum = cells.reduce((sum, cell) => sum + (cell.suppressed ? 0 : cell.value), 0);
          if (total > 0 && total < k) expect(hidden).toHaveLength(cells.length);
          else if (counts.length > 1)
            expect(hidden.length !== 1 && (hidden.length === 0 || total - shownSum > 0)).toBe(true);
          cells.forEach((cell, i) =>
            expect(
              cell.suppressed || (cell.value === counts[i] && (cell.value === 0 || cell.value >= k)),
            ).toBe(true),
          );
        },
      ),
    );
  });
});
