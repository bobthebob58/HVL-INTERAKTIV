/**
 * Unit tests of the per-learner facts insight starts from: stored rows become numbered learners and page loads (no key
 * leaves the reader), each learner's first and latest answer per question, when an answer is correct, and medians.
 *
 * Spec: INS-001, INS-002, DATA-012
 */
import { describe, expect, it } from 'vitest';
import { answersByItem, isCorrectAnswer, medianOf } from '../../src/insight/aggregate/learnerAnswers.js';
import { toInsightStatements, type StoredInsightRow } from '../../src/insight/data/insightStatements.js';

const VIEW_A = '7d3c2b1a-0f9e-4d8c-b7a6-958473625140';
const VIEW_B = '7d3c2b1a-0f9e-4d8c-b7a6-958473625141';
const row = (
  learnerKey: string,
  attemptId: string,
  minute: number,
  rest: Partial<StoredInsightRow> = {},
): StoredInsightRow => ({
  learnerKey,
  attemptId,
  subContentId: null,
  verb: 'attempted',
  scoreRaw: null,
  scoreMax: null,
  success: null,
  response: null,
  timestamp: new Date(Date.UTC(2026, 10, 2, 8, minute)),
  ...rest,
});

describe('[DATA-012] the rows insight reads', () => {
  it('[DATA-012] numbers learners and page loads in order of first appearance and keeps no key', () => {
    // Arrange
    const rows = [
      row('key-zeta', `${VIEW_A}:1`, 0),
      row('key-alpha', `${VIEW_A}:1`, 1),
      row('key-zeta', `${VIEW_A}:2`, 2),
      row('key-zeta', `${VIEW_B}:1`, 3),
    ];
    // Act
    const statements = toInsightStatements(rows);
    // Assert
    expect(statements.map(({ learner, view, at }) => [learner, view, at])).toEqual([
      [0, 0, Date.UTC(2026, 10, 2, 8, 0)],
      [1, 1, Date.UTC(2026, 10, 2, 8, 1)],
      [0, 0, Date.UTC(2026, 10, 2, 8, 2)],
      [0, 2, Date.UTC(2026, 10, 2, 8, 3)],
    ]);
    expect(JSON.stringify(statements)).not.toMatch(/key-|7d3c2b1a/);
  });
});

describe('[INS-002] first and latest answers', () => {
  it('[INS-002] keeps each learner’s first and latest answer per question, the root as null', () => {
    // Arrange
    const statements = toInsightStatements([
      row('a', `${VIEW_A}:1`, 0, { verb: 'answered', subContentId: 'q', response: '1' }),
      row('a', `${VIEW_A}:1`, 1, { verb: 'answered', subContentId: 'q', response: '2' }),
      row('a', `${VIEW_A}:2`, 2, { verb: 'answered', subContentId: 'q', response: '0' }),
      row('b', `${VIEW_B}:1`, 3, { verb: 'answered', response: '0' }),
      row('b', `${VIEW_B}:1`, 4, { verb: 'completed', scoreRaw: 1, scoreMax: 1 }),
    ]);
    // Act
    const answers = answersByItem(statements);
    // Assert
    const first = answers.get('q')?.get(0);
    expect([first?.first.response, first?.latest.response]).toEqual(['1', '0']);
    expect([...(answers.get(null)?.keys() ?? [])]).toEqual([1]);
    expect(answers.size).toBe(2);
  });

  it.each([
    [{ success: true, scoreRaw: 0, scoreMax: 1 }, true],
    [{ success: false, scoreRaw: 1, scoreMax: 1 }, false],
    [{ success: null, scoreRaw: 2, scoreMax: 2 }, true],
    [{ success: null, scoreRaw: 1, scoreMax: 2 }, false],
    [{ success: null, scoreRaw: 0, scoreMax: 0 }, undefined],
    [{ success: null, scoreRaw: null, scoreMax: null }, undefined],
  ])('[INS-002] judges %o as %s (success, else full marks, D-115)', (answer, verdict) => {
    expect(isCorrectAnswer(answer)).toBe(verdict);
  });

  it('[INS-001] takes the median of an odd and an even list, and NaN of none', () => {
    expect(medianOf([5, 1, 3])).toBe(3);
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
    expect(medianOf([])).toBeNaN();
  });
});
