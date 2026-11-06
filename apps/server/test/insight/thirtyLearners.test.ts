/**
 * Unit tests of the insight aggregates on the hand-calculated 30-learner fixture (fixtures/README.md): participation,
 * item difficulty and misconceptions of the QuestionSet, with k = 5 and k = 3, in a Canvas course and in the portal.
 *
 * Spec: INS-001, INS-002, INS-003, INS-006
 */
import { describe, expect, it } from 'vitest';
import type { ChoiceMisconception, GapMisconception } from '../../src/insight/insightReport.js';
import { minimumGroupSize } from '../../src/privacy/minimumGroupSize.js';
import { Q1, Q2, Q3, QUESTION_SET } from './fixtures/insightActivities.js';
import { questionSetRows } from './fixtures/thirtyLearners.js';
import { reportOf, shown } from './support/insightFixtureReport.js';

const inCourse = reportOf(QUESTION_SET, questionSetRows(), { courseLearners: 40 });
const choice = (item: string, report = inCourse) =>
  report.misconceptions.find((entry) => entry.item === item) as ChoiceMisconception;
const gaps = (item: string, report = inCourse) =>
  report.misconceptions.find((entry) => entry.item === item) as GapMisconception;
const gapView = (gap: GapMisconception['gaps'][number]) => ({
  correct: shown(gap.correct),
  wrong: gap.wrongAnswers.map(({ answer, learners }) => [answer, shown(learners)]),
  otherWrong: shown(gap.otherWrong),
  empty: shown(gap.empty),
});

describe('[INS-001] the 30-learner fixture', () => {
  it('[INS-001] numbers match the hand-calculated 30-learner fixture (course, NRPS base 40)', () => {
    // Act and assert: the report is built once from the fixture's rows, above.
    expect({
      started: shown(inCourse.participation.started),
      completed: shown(inCourse.participation.completed),
      rate: shown(inCourse.participation.completionRate),
      base: inCourse.participation.completionBase,
      courseLearners: shown(inCourse.participation.courseLearners),
      minutes: shown(inCourse.participation.medianMinutesOnTask),
      attempts: shown(inCourse.participation.medianAttempts),
    }).toEqual({
      started: 28,
      completed: 23,
      rate: 0.575,
      base: 'course',
      courseLearners: 40,
      minutes: 11,
      attempts: 1,
    });
  });

  it('[INS-001] uses "of those who started" as the base without an NRPS count (the portal)', () => {
    const portal = reportOf(QUESTION_SET, questionSetRows());
    expect(portal.participation.completionBase).toBe('started');
    expect(shown(portal.participation.completionRate)).toBe(0.8214);
    expect(portal.participation.courseLearners).toBeNull();
  });
});

describe('[INS-002] the 30-learner fixture', () => {
  it('[INS-002] numbers match the hand-calculated fixture, hardest first, with the question text', () => {
    // Act and assert: the items of the report built above, against README.md's table.
    expect(
      inCourse.items.map((item) => [
        item.item,
        shown(item.learners),
        shown(item.firstCorrect),
        shown(item.latestCorrect),
      ]),
    ).toEqual([
      [Q1, 26, 0.4615, 0.7692],
      [Q3, 23, 0.5217, 0.8696],
      [Q2, 26, 0.5769, 0.8846],
    ]);
    expect(inCourse.items.map(({ questionText }) => questionText)).toEqual([
      'Kva er hovudføremålet med forarbeid?',
      'Dra orda på rett plass.',
      'Fyll inn orda som manglar.',
    ]);
  });
});

describe('[INS-003] the 30-learner fixture', () => {
  it('[INS-003] distributes the first choices with the teacher’s feedback for each wrong option', () => {
    const q1 = choice(Q1);
    expect(
      q1.options.map((option) => [option.text, option.correct, option.feedback, shown(option.learners)]),
    ).toEqual([
      ['Aktivere forkunnskapar', true, null, 12],
      ['Erstatte forelesinga', false, 'Forarbeid førebur samlinga, det erstattar henne ikkje.', 8],
      ['Gi karakter', false, 'Poenga er formative & gir ingen karakter.', '<k'],
      ['Spare tid for læraren', false, null, '<k'],
    ]);
    expect([shown(q1.learners), shown(q1.noAnswer)]).toEqual([26, 0]);
  });

  it('[INS-003] lists the wrong gap answers k learners gave, normalised, with complementary suppression', () => {
    // Act and assert: per gap, right, listed wrong answers, other wrong and empty (README.md).
    expect(gaps(Q2).gaps.map(gapView)).toEqual([
      { correct: 15, wrong: [['henting', 11]], otherWrong: 0, empty: 0 },
      { correct: 23, wrong: [], otherWrong: '<k', empty: '<k' },
    ]);
    expect(gaps(Q3).gaps.map(gapView)).toEqual([
      { correct: 15, wrong: [['forarbeid', 8]], otherWrong: 0, empty: 0 },
      { correct: 12, wrong: [['samling', 8]], otherWrong: '<k', empty: '<k' },
    ]);
    expect(gaps(Q2).gaps.map(({ correctAnswers }) => correctAnswers)).toEqual([
      ['uthenting'],
      ['spreidd', 'spredt'],
    ]);
  });

  it('[INS-003] never shows a free-text answer fewer than k learners gave', () => {
    expect(JSON.stringify(inCourse)).not.toContain('etterarbeid');
  });
});

describe('[INS-006] the 30-learner fixture with another k', () => {
  it('[INS-006] shows the 3-learner groups when k is 3 (configurable, at least 3)', () => {
    // Arrange
    const k3 = reportOf(QUESTION_SET, questionSetRows(), { size: minimumGroupSize(3), courseLearners: 40 });
    // Act
    const options = choice(Q1, k3).options.map(({ learners }) => shown(learners));
    // Assert
    expect(options).toEqual([12, 8, 3, 3]);
    expect(gaps(Q2, k3).gaps.map(gapView)[1]).toEqual({ correct: 23, wrong: [], otherWrong: 0, empty: 3 });
    expect(gaps(Q3, k3).gaps.map(gapView)[1]).toEqual({
      correct: 12,
      wrong: [
        ['samling', 8],
        ['etterarbeid', 3],
      ],
      otherWrong: 0,
      empty: 0,
    });
  });

  it('[INS-006] carries no learner key or attempt ID in the report', () => {
    const text = JSON.stringify(inCourse);
    expect(text).not.toContain('fixture-learner');
    expect(text).not.toContain('00000000-0000-4000-8000');
  });
});

describe('[INS-006] views about a hidden group, and older versions', () => {
  it('[INS-006] hides even the 0s of every question when the learners who started number fewer than k', () => {
    // Arrange: L21–L23 only (group C): three learners, none of whom answered Q3.
    const rows = questionSetRows().filter(({ learnerKey }) => /-2[123]$/.test(learnerKey));
    // Act
    const report = reportOf(QUESTION_SET, rows);
    // Assert: "nobody answered Q3" would describe each of the three.
    expect(shown(report.participation.started)).toBe('<k');
    expect(report.items.map(({ learners }) => shown(learners))).toEqual(['<k', '<k', '<k']);
    expect(JSON.stringify(report.misconceptions)).not.toMatch(/"suppressed":false/);
  });

  it('[PROD-013] gives no answer breakdown for an older version, whose options and gaps are no longer stored', () => {
    // Act: the same rows reported as version 1 of an activity now at version 2.
    const older = reportOf(QUESTION_SET, questionSetRows(), {
      scope: { contentVersion: 1, currentVersion: 2 },
    });
    // Assert: participation and item difficulty stay; INS-003 would pair old answers with today's texts.
    expect(older.misconceptions).toEqual([]);
    expect(shown(older.participation.started)).toBe(28);
    expect(older.items.map(({ item }) => item)).toEqual([Q1, Q3, Q2]);
  });
});
