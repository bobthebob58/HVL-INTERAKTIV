/**
 * Property test of INS-006 at the API boundary (fast-check, D-114): for random datasets and any k from 3, the JSON
 * answer of `GET …/insight` and the CSV of `GET …/insight/export`, as a client receives them, contain no group smaller
 * than k, no hidden value that a total reveals, no field the contract does not name, and no learner.
 *
 * Spec: INS-006, INS-009, INS-001
 */
import { insightReportSchema } from '@hvl-interaktiv/api-contract';
import fc from 'fast-check';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { insightCsvRows } from '../../../src/insight/export/insightCsvRows.js';
import type { InsightReport } from '../../../src/insight/insightReport.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { INTERACTIVE_VIDEO, IV1, IV2, IV3, Q1, Q2, QUESTION_SET } from '../fixtures/insightActivities.js';
import type { FixtureRow } from '../fixtures/thirtyLearners.js';
import { reportOf } from '../support/insightFixtureReport.js';
import { cellsIn, insightInvariantViolations } from '../support/reportInvariants.js';
import { parseCsv } from './support/csvRecords.js';
import { insightStubApp } from './support/insightStubApp.js';

/** The activity of the fixture's scope (../support/insightFixtureReport.ts). */
const CONTENT = '0190f5d2-0000-7000-8000-000000000001';
/** The CSV measures that are counts of learners (the others are shares and medians). */
const COUNT_MEASURES = new Set([
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
const WORDS = ['uthenting', ' Uthenting ', 'henting', '', '=feil', 'spreidd'];

const play = fc.record({
  opened: fc.boolean(),
  q1: fc.array(fc.integer({ min: -1, max: 4 }), { maxLength: 3 }),
  q2: fc.array(fc.tuple(fc.constantFrom(...WORDS), fc.constantFrom(...WORDS)), { maxLength: 2 }),
  results: fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 2 }),
  video: fc.array(fc.constantFrom(IV1, IV2, IV3), { maxLength: 3 }),
});
type Play = typeof play extends fc.Arbitrary<infer T> ? T : never;
const dataset = fc.record({
  k: fc.integer({ min: 3, max: 7 }),
  video: fc.boolean(),
  courseLearners: fc.option(fc.integer({ min: 0, max: 60 }), { nil: undefined }),
  learners: fc.array(play, { maxLength: 40 }),
});

/** One learner's rows: a page load with answers to Q1 and Q2 and results, or answers in the video. */
function rowsOf(n: number, learner: Play, video: boolean): FixtureRow[] {
  const answered = (subContentId: string, scoreRaw: number, scoreMax: number, response: string) => ({
    verb: 'answered' as const,
    subContentId,
    scoreRaw,
    scoreMax,
    success: scoreRaw === scoreMax,
    response,
  });
  const steps = [
    ...(learner.opened ? [{ verb: 'attempted' as const, subContentId: null }] : []),
    ...(video
      ? learner.video.map((item) => answered(item, 1, 1, '0'))
      : [
          ...learner.q1.map((option) =>
            answered(Q1, option === 0 ? 1 : 0, 1, option < 0 ? '' : String(option)),
          ),
          ...learner.q2.map(([a, b]) => answered(Q2, 1, 2, `${a}[,]${b}`)),
          ...learner.results.map((raw) => ({
            verb: 'completed' as const,
            subContentId: null,
            scoreRaw: raw,
            scoreMax: 5,
          })),
        ]),
  ];
  return steps.map((step, i) => ({
    scoreRaw: null,
    scoreMax: null,
    success: null,
    response: null,
    ...step,
    learnerKey: `property-learner-${n}`,
    attemptId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}:1`,
    timestamp: new Date(Date.UTC(2026, 10, 2, 8, n, i)),
  }));
}

describe('[INS-006] suppression at the API boundary', () => {
  it('[INS-006] for random datasets no JSON answer or CSV file contains a group smaller than k or a learner', async () => {
    await fc.assert(
      fc.asyncProperty(dataset, async ({ k, video, courseLearners, learners }) => {
        // Arrange
        const rows = learners.flatMap((learner, n) => rowsOf(n, learner, video));
        const activity = video ? INTERACTIVE_VIDEO : QUESTION_SET;
        const report = reportOf(activity, rows, { size: minimumGroupSize(k), courseLearners });
        const { app } = insightStubApp(report);
        // Act
        const json = await request(app).get(`/api/content/${CONTENT}/insight`);
        const csv = await request(app).get(`/api/content/${CONTENT}/insight/export`);
        // Assert
        const received = insightReportSchema.parse(json.body) as InsightReport;
        expect(insightInvariantViolations(received)).toEqual([]);
        const values = parseCsv(csv.text.slice(1)).slice(11);
        const expected = insightCsvRows(received);
        expect(values.map((record) => record[5])).toEqual(expected.map((row) => row.value));
        expect(values.filter((record) => record[5] === `< ${k}`)).toHaveLength(
          cellsIn(received).filter((cell) => cell.suppressed).length,
        );
        expected.forEach(({ measure }, i) => {
          const value = values[i]?.[5] ?? '';
          if (COUNT_MEASURES.has(measure) && value !== `< ${k}` && value !== '')
            expect(Number(value) === 0 || Number(value) >= k).toBe(true);
        });
        for (const text of [JSON.stringify(json.body), csv.text])
          expect(text).not.toContain('property-learner');
      }),
      { numRuns: 60 },
    );
  }, 60_000);
});
