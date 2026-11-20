/**
 * Unit tests of which questions outside the activity's current content an insight view and its CSV list (D-121):
 * none that fewer than k learners answered, whatever their IDs are, and never more than the limit.
 *
 * Spec: INS-002, INS-006
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MAX_UNLISTED_ITEMS } from '../../src/insight/aggregate/itemDifficulty.js';
import { insightCsvText } from '../../src/insight/http/insightCsvText.js';
import { Q1, Q2, Q3, QUESTION_SET } from './fixtures/insightActivities.js';
import { learnerKey, questionSetRows, type FixtureRow } from './fixtures/thirtyLearners.js';
import { reportOf, shown } from './support/insightFixtureReport.js';

const AT = new Date('2026-11-03T10:00:00.000Z');
/** One `answered` of a learner about an item, inside the fixture's view. */
const answer = (learner: number, item: string): FixtureRow => ({
  learnerKey: learnerKey(learner),
  attemptId: `${randomUUID()}:1`,
  subContentId: item,
  verb: 'answered',
  scoreRaw: 1,
  scoreMax: 1,
  success: true,
  response: '0',
  timestamp: AT,
});
/** Answers of `learners` learners (numbered from 1) about an item. */
const answeredBy = (learners: number, item: string): FixtureRow[] =>
  Array.from({ length: learners }, (_, n) => answer(n + 1, item));

describe('[INS-002] questions outside the current content', () => {
  it('[INS-006] one learner’s answers add no question to the view, whatever ID they carry', () => {
    // Arrange: a text and many IDs of one learner's own choosing, and one ID that four learners used (k is 5)
    const own = ['hello teacher', ...Array.from({ length: 60 }, () => randomUUID())];
    const shared = randomUUID();
    const rows = [...questionSetRows(), ...own.map((item) => answer(1, item)), ...answeredBy(4, shared)];
    // Act
    const report = reportOf(QUESTION_SET, rows);
    // Assert
    expect(report.items.map(({ item }) => item).sort()).toEqual([Q1, Q2, Q3].sort());
    for (const text of [JSON.stringify(report), insightCsvText(report, 'nn')]) {
      expect(text).not.toContain('hello teacher');
      expect(text).not.toContain(shared);
    }
  });

  it('[INS-002] a question of an older version is listed, without a text, once k learners answered it', () => {
    // Arrange
    const older = randomUUID();
    // Act
    const report = reportOf(QUESTION_SET, [...questionSetRows(), ...answeredBy(5, older)]);
    const listed = report.items.find(({ item }) => item === older);
    // Assert
    expect(report.items).toHaveLength(4);
    expect(listed).toMatchObject({ library: null, questionText: null });
    expect(shown(listed?.learners ?? null)).toBe(5);
  });

  it('[INS-002] lists at most the limit of such questions, those with most learners first', () => {
    // Arrange: more older questions than the limit with 5 learners each, and one with 7
    const many = Array.from({ length: MAX_UNLISTED_ITEMS + 10 }, () => randomUUID());
    const most = randomUUID();
    const rows = [
      ...questionSetRows(),
      ...many.flatMap((item) => answeredBy(5, item)),
      ...answeredBy(7, most),
    ];
    // Act
    const items = reportOf(QUESTION_SET, rows).items.map(({ item }) => item);
    // Assert
    expect(items).toHaveLength(3 + MAX_UNLISTED_ITEMS);
    expect(items).toContain(most);
    expect(MAX_UNLISTED_ITEMS).toBe(50);
  });
});
