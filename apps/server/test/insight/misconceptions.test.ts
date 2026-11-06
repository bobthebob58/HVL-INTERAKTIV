/**
 * Unit tests of INS-003's edge cases: multi-select and out-of-range choices, answers that name no option, a response
 * that was not stored, case-sensitive Blanks, the five-answer limit with ties, and a free-text answer below k.
 *
 * Spec: INS-003, INS-006
 */
import { describe, expect, it } from 'vitest';
import { chosenOptions, choiceDistribution } from '../../src/insight/aggregate/choiceDistribution.js';
import { gapMisconceptions } from '../../src/insight/aggregate/gapMisconceptions.js';
import type { LearnerItemAnswers } from '../../src/insight/aggregate/learnerAnswers.js';
import type { InsightStatement } from '../../src/insight/data/insightStatements.js';
import { minimumGroupSize } from '../../src/privacy/minimumGroupSize.js';
import { shown } from './support/insightFixtureReport.js';

const k3 = minimumGroupSize(3);
/** Learners whose first answers are the given responses, in order. */
const firstAnswers = (responses: readonly (string | null)[]): LearnerItemAnswers[] =>
  responses.map((response, learner) => {
    const answer: InsightStatement = {
      learner,
      view: learner,
      item: 'q',
      verb: 'answered',
      scoreRaw: 0,
      scoreMax: 1,
      success: null,
      response,
      at: learner,
    };
    return { first: answer, latest: answer };
  });
const repeat = <T>(value: T, times: number): T[] => Array<T>(times).fill(value);

describe('[INS-003] choices', () => {
  it('[INS-003] reads distinct option indices in range from a response', () => {
    expect([...chosenOptions('0[,]2[,]2[,]7[,]x[,] 1 ', 4)]).toEqual([0, 2, 1]);
    expect(chosenOptions(null, 4).size).toBe(0);
  });

  it('[INS-003] counts a multi-select learner once per option and an answer naming no option as no answer', () => {
    // Arrange
    const options = ['A', 'B', 'C'].map((text, i) => ({
      text,
      correct: i === 0,
      feedback: i === 0 ? null : `Ikkje ${text}`,
    }));
    const answers = firstAnswers([...repeat('0[,]1', 3), ...repeat('1', 3), ...repeat('9', 3)]);
    // Act
    const view = choiceDistribution(k3, { item: 'q', text: 'Kva?' }, options, answers);
    // Assert
    expect(view.options.map(({ learners }) => shown(learners))).toEqual([3, 6, 0]);
    expect([shown(view.learners), shown(view.noAnswer)]).toEqual([9, 3]);
    expect(view.options[1]?.feedback).toBe('Ikkje B');
  });

  it('[INS-006] protects a multi-answer question as one group, since INS-002 counts only full right sets', () => {
    // Arrange: A and B are right; 6 chose both, 2 only A, 6 chose C, 2 gave no answer (16 learners, k = 5).
    const options = ['A', 'B', 'C'].map((text, i) => ({ text, correct: i < 2, feedback: null }));
    const responses = [...repeat('0[,]1', 6), ...repeat('0', 2), ...repeat('2', 6), ...repeat('', 2)];
    // Act
    const view = choiceDistribution(
      minimumGroupSize(5),
      { item: 'q', text: '' },
      options,
      firstAnswers(responses),
    );
    // Assert: one group (8, 6, 6, 2): the 2 has no 0 to hide with, so each count within k of the last is hidden.
    expect([...view.options.map(({ learners }) => shown(learners)), shown(view.noAnswer)]).toEqual([
      '<k',
      '<k',
      '<k',
      '<k',
    ]);
  });
});

describe('[INS-003] gaps', () => {
  it('[INS-003] lists at most five wrong answers, most frequent first, ties alphabetically', () => {
    // Arrange: six wrong answers of 3 learners each, then one of 4.
    const words = ['f', 'e', 'd', 'c', 'b', 'a'];
    const answers = firstAnswers([
      ...words.flatMap((word) => repeat(word, 3)),
      ...repeat('z', 4),
      ...repeat('rett', 3),
    ]);
    // Act
    const view = gapMisconceptions(
      k3,
      { item: 'q', text: '' },
      { gaps: [{ answers: ['rett'] }], caseSensitive: false },
      answers,
    );
    // Assert
    const [gap] = view.gaps;
    expect(gap?.wrongAnswers.map(({ answer, learners }) => [answer, shown(learners)])).toEqual([
      ['z', 4],
      ['a', 3],
      ['b', 3],
      ['c', 3],
      ['d', 3],
    ]);
    expect([shown(gap?.otherWrong ?? null), shown(gap?.correct ?? null), shown(gap?.empty ?? null)]).toEqual([
      6, 3, 0,
    ]);
  });

  it('[INS-003] counts a response that was not stored, and a missing gap, as empty', () => {
    // Act and assert: three responses dropped by the 1 000-character cap, three with only the first gap.
    const answers = firstAnswers([...repeat(null, 3), ...repeat('rett', 3)]);
    const view = gapMisconceptions(
      k3,
      { item: 'q', text: '' },
      { gaps: [{ answers: ['rett'] }, { answers: ['to'] }], caseSensitive: false },
      answers,
    );
    expect(view.gaps.map((gap) => [shown(gap.correct), shown(gap.empty)])).toEqual([
      [3, 3],
      [0, 6],
    ]);
  });

  it('[INS-003] tells case apart for a case-sensitive Blanks but groups the wrong answers case-folded', () => {
    // Act and assert: «Ola» is right; «ola» and «OLA» are one wrong answer of three learners.
    const answers = firstAnswers([...repeat('Ola', 3), ...repeat('ola', 2), ...repeat('OLA', 1)]);
    const view = gapMisconceptions(
      k3,
      { item: 'q', text: '' },
      { gaps: [{ answers: ['Ola'] }], caseSensitive: true },
      answers,
    );
    expect(view.gaps[0]?.wrongAnswers.map(({ answer, learners }) => [answer, shown(learners)])).toEqual([
      ['ola', 3],
    ]);
    expect(shown(view.gaps[0]?.correct ?? null)).toBe(3);
  });

  it('[INS-003] never shows a free-text answer fewer than k learners gave, only counts it', () => {
    // Arrange
    const answers = firstAnswers([...repeat('rett', 5), 'Kari Nordmann', ...repeat('feil', 3)]);
    // Act
    const view = gapMisconceptions(
      k3,
      { item: 'q', text: '' },
      { gaps: [{ answers: ['rett'] }], caseSensitive: false },
      answers,
    );
    // Assert
    expect(JSON.stringify(view)).not.toMatch(/kari/i);
    expect(view.gaps[0]?.wrongAnswers.map(({ answer }) => answer)).toEqual(['feil']);
    expect(shown(view.gaps[0]?.otherWrong ?? null)).toBe('<k');
  });
});
