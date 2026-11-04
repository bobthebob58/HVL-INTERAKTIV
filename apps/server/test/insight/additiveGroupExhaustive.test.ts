/**
 * Exhaustive tests of INS-006's complementary suppression: for every small group (k 3–6, two to five cells), a reader
 * who sees the total and the shown cells and knows the rule cannot work out any hidden count of 1 to k − 1; a
 * single-answer question stays protected when INS-002's share correct tells how many chose the right option; and a
 * gap stays protected although the public rule tells that each listed wrong answer holds k or more.
 *
 * Why: the rule is public (INS-006, D-106), so "cannot be worked out" means: every count vector that gives the same
 *      answer leaves each hidden cell with at least two possible values. Random tests miss the rare vectors where it
 *      fails; walking all of them does not.
 * Spec: INS-006, INS-003
 */
import { describe, expect, it } from 'vitest';
import { choiceDistribution } from '../../src/insight/aggregate/choiceDistribution.js';
import { gapMisconceptions } from '../../src/insight/aggregate/gapMisconceptions.js';
import type { LearnerItemAnswers } from '../../src/insight/aggregate/learnerAnswers.js';
import {
  additiveGroupCells,
  partitionedGroupCells,
} from '../../src/insight/suppression/additiveGroupCells.js';
import { minimumGroupSize, type MinimumGroupSize } from '../../src/privacy/minimumGroupSize.js';

type Cells = ReturnType<typeof additiveGroupCells>;

/** Every vector of `n` counts from 0 to `max`. */
function* vectors(n: number, max: number): Generator<number[]> {
  if (n === 0) {
    yield [];
    return;
  }
  for (const rest of vectors(n - 1, max)) for (let v = 0; v <= max; v += 1) yield [...rest, v];
}

const answerOf = (cells: Cells): string => cells.map((c) => (c.suppressed ? 'h' : c.value)).join(',');

/**
 * The hidden counts of 1 to k − 1 a reader can work out: vectors are grouped by what the reader sees (`seen`), and a
 * hidden cell with one possible value in its group is worked out. A group whose hidden sum exceeds `max` is skipped,
 * since there the walk's own bound, not the answer, would limit the values.
 */
function workedOut(
  size: MinimumGroupSize,
  n: number,
  max: number,
  seen: (counts: number[]) => { key: string; cells: Cells; hiddenSum: number },
): string[] {
  const groups = new Map<string, { cells: Cells; hiddenSum: number; members: number[][] }>();
  for (const counts of vectors(n, max)) {
    const view = seen(counts);
    const group = groups.get(view.key) ?? { cells: view.cells, hiddenSum: view.hiddenSum, members: [] };
    group.members.push(counts);
    groups.set(view.key, group);
  }
  const found: string[] = [];
  for (const [key, { cells, hiddenSum, members }] of groups) {
    if (hiddenSum > max) continue;
    cells.forEach((cell, index) => {
      const values = new Set(members.map((member) => member[index]));
      const [only = 0] = [...values];
      if (cell.suppressed && values.size === 1 && only > 0 && only < size.k) found.push(`${key} → ${index}`);
    });
  }
  return found;
}

const sum = (counts: readonly number[]): number => counts.reduce((total, count) => total + count, 0);
const hiddenSumOf = (counts: readonly number[], cells: Cells): number =>
  sum(counts.filter((_, index) => cells[index]?.suppressed === true));

describe('[INS-006] complementary suppression, exhaustively', () => {
  it.each([3, 4, 5, 6])(
    '[INS-006] with k = %d no hidden count of 1 to k − 1 can be worked out from the total and the shown cells',
    (k) => {
      // Arrange
      const size = minimumGroupSize(k);
      // Act: every vector of two to five cells (counts up to 12, or 9 for five cells).
      const found = [2, 3, 4, 5].flatMap((n) =>
        workedOut(size, n, n <= 4 ? 12 : 9, (counts) => {
          const cells = additiveGroupCells(size, sum(counts), counts);
          return { key: `${sum(counts)}|${answerOf(cells)}`, cells, hiddenSum: hiddenSumOf(counts, cells) };
        }),
      );
      // Assert: the one residual (module header of additiveGroupCells.ts): k or more cells that each hold 1, all
      // hidden, with no other cell left to hide; only hiding the total could protect them.
      const residual = (entry: string) => {
        const [total = '', cells = ''] = (entry.split(' → ')[0] ?? '').split('|');
        const hidden = cells.split(',');
        return hidden.every((cell) => cell === 'h') && Number(total) === hidden.length;
      };
      expect(found.filter((entry) => !residual(entry))).toEqual([]);
    },
  );
});

/** Learners whose first answers chose these options ('' for none). */
const learnersChoosing = (counts: readonly number[]): LearnerItemAnswers[] =>
  counts.flatMap((count, option) =>
    Array.from({ length: count }, (_, at) => {
      const response = option === counts.length - 1 ? '' : String(option);
      const answer = {
        ...{ learner: option * 100 + at, view: option * 100 + at, item: 'q', verb: 'answered' },
        ...{ scoreRaw: null, scoreMax: null, success: null, response, at },
      };
      return { first: answer, latest: answer };
    }),
  );

describe('[INS-003] a choice question with INS-002 beside it', () => {
  const options = ['Rett', 'Feil 1', 'Feil 2'].map((text, i) => ({ text, correct: i === 0, feedback: null }));

  it('[INS-006] no hidden wrong option can be worked out when the share correct tells how many chose right', () => {
    // Arrange
    const size = minimumGroupSize(5);
    // Act: right, two wrong options and «no answer»; the reader also knows the number right (INS-002).
    const found = workedOut(size, 4, 9, (counts) => {
      const view = choiceDistribution(size, { item: 'q', text: '' }, options, learnersChoosing(counts));
      const cells = [...view.options.map(({ learners }) => learners), view.noAnswer];
      const key = `${sum(counts)}|${counts[0]}|${answerOf(cells)}`;
      return { key, cells, hiddenSum: hiddenSumOf(counts, cells) };
    });
    // Assert: only the right option itself, which INS-002's share already gives away (D-106), may be known.
    expect(found.filter((entry) => !entry.endsWith('→ 0'))).toEqual([]);
  });

  it('[INS-006] hides a wrong option the share correct would otherwise give away', () => {
    // Arrange: 4 right (20 % of 20 in INS-002), 3 and 13 wrong, nobody without an answer.
    const size = minimumGroupSize(5);
    // Act
    const cells = partitionedGroupCells(size, 20, [4, 3, 13, 0], [[0], [1, 2, 3]]);
    const view = choiceDistribution(size, { item: 'q', text: '' }, options, learnersChoosing([4, 3, 13, 0]));
    // Assert: 20 − 4 − 13 − 0 would be the 3, so the 0 is hidden with it.
    expect(answerOf(cells)).toBe('h,h,13,h');
    expect(answerOf([...view.options.map(({ learners }) => learners), view.noAnswer])).toBe('h,h,13,h');
  });
});

describe('[INS-003] a gap with a listed wrong answer beside the others', () => {
  it('[INS-006] no hidden gap count can be worked out from a listed wrong answer, which holds k or more', () => {
    // Arrange: a gap's right answers, one wrong word, other wrong words (one learner each) and empty gaps. The wrong
    // word is listed only when k or more gave it, and the rule is public, so a hidden listed count would be known
    // to hold k or more. A second gap keeps INS-002's share from telling the right answers.
    const learnersGiving = (words: readonly string[]) =>
      words.map((word, learner) => {
        const answer = {
          learner,
          view: learner,
          item: 'q',
          verb: 'answered',
          scoreRaw: null,
          scoreMax: null,
        };
        const first = { ...answer, success: null, response: `${word}[,]to`, at: learner };
        return { first, latest: first };
      });
    const gaps = { gaps: [{ answers: ['rett'] }, { answers: ['to'] }], caseSensitive: false };
    const found = [3, 4, 5, 6].flatMap((k) => {
      const size = minimumGroupSize(k);
      // Act: counts are [right, listed word (0, or k − 1 + n), other, empty]; the listed cell sits at index 1.
      return workedOut(size, 4, 9, ([right = 0, word = 0, other = 0, empty = 0]) => {
        const listed = word === 0 ? 0 : word + k - 1;
        const words = [right, listed, other, empty].flatMap((count, at) =>
          Array.from({ length: count }, (_, n) => ['rett', 'feil', `ord${n}`, ''][at] ?? ''),
        );
        const view = gapMisconceptions(size, { item: 'q', text: '' }, gaps, learnersGiving(words)).gaps[0];
        if (!view) throw new Error('the task has two gaps');
        const listedCell = view.wrongAnswers[0]?.learners ?? { suppressed: false as const, value: 0 };
        const cells: Cells = [view.correct, listedCell, view.otherWrong, view.empty];
        const key = `${words.length}|${answerOf(cells)}`;
        return { key, cells, hiddenSum: hiddenSumOf([right, listed, other, empty], cells) };
      });
    });
    // Assert: only the first test's residual (k = 3: the three other cells hidden, each holding 1).
    const residual = (entry: string) => {
      const [total = '', cells = ''] = (entry.split(' → ')[0] ?? '').split('|');
      const [right, word = 'h', other, empty] = cells.split(',');
      return [right, other, empty].every((cell) => cell === 'h') && Number(total) - Number(word) === 3;
    };
    expect(found.filter((entry) => !residual(entry))).toEqual([]);
  });
});
