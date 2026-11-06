/**
 * Unit tests of the INS-006 suppression core: counts, rates and medians below k carry no value, a whole small group
 * is hidden, an additive group never keeps a hidden cell a reader could work out (complementary suppression), and a
 * part whose total INS-002 reveals is protected on its own.
 *
 * Spec: INS-006
 */
import { describe, expect, it } from 'vitest';
import {
  additiveGroupCells,
  partitionedGroupCells,
} from '../../src/insight/suppression/additiveGroupCells.js';
import {
  countCell,
  medianCell,
  rateCell,
  SUPPRESSED_CELL,
  suppressEveryCell,
  withinShownGroup,
} from '../../src/insight/suppression/insightCells.js';
import { minimumGroupSize } from '../../src/privacy/minimumGroupSize.js';

const k5 = minimumGroupSize(5);
const values = (cells: readonly ({ suppressed: true } | { suppressed: false; value: number })[]) =>
  cells.map((cell) => (cell.suppressed ? '<k' : cell.value));

describe('[INS-006] cells', () => {
  it.each([
    [0, { suppressed: false, value: 0 }],
    [1, { suppressed: true }],
    [4, { suppressed: true }],
    [5, { suppressed: false, value: 5 }],
    [31, { suppressed: false, value: 31 }],
  ])('[INS-006] a count of %d learners is %o', (learners, cell) => {
    expect(countCell(k5, learners)).toEqual(cell);
  });

  it('[INS-006] a suppressed cell has exactly one key and no value', () => {
    expect(Object.keys(countCell(k5, 3))).toEqual(['suppressed']);
    expect(SUPPRESSED_CELL).toEqual({ suppressed: true });
    expect(Object.isFrozen(SUPPRESSED_CELL)).toBe(true);
  });

  it.each([
    [0, 5, { suppressed: false, value: 0 }],
    [1, 12, { suppressed: false, value: 1 }],
    [0.5, 4, { suppressed: true }],
    [Number.NaN, 0, { suppressed: true }],
    [1.2, 6, { suppressed: false, value: 1 }],
  ])('[INS-006] a share of %d over %d learners is %o (0 % and 100 % stay, D-106)', (share, about, cell) => {
    expect(rateCell(k5, share, about)).toEqual(cell);
  });

  it('[INS-006] a median is hidden below k learners, and when it cannot be computed', () => {
    expect(medianCell(k5, 11, 5)).toEqual({ suppressed: false, value: 11 });
    expect(medianCell(k5, 11, 4)).toEqual({ suppressed: true });
    expect(medianCell(k5, Number.NaN, 9)).toEqual({ suppressed: true });
  });

  it('[INS-006] hides any cell, a 0 too, of a group whose total is hidden', () => {
    expect(withinShownGroup(countCell(k5, 0), false)).toEqual({ suppressed: true });
    expect(withinShownGroup(countCell(k5, 7), true)).toEqual({ suppressed: false, value: 7 });
  });

  it('[INS-006] refuses a k below 3, so the protection cannot be lowered', () => {
    expect(() => minimumGroupSize(2)).toThrow(RangeError);
  });
});

describe('[INS-006] additive groups', () => {
  it.each([
    ['nothing small', 30, [12, 8, 10, 0], [12, 8, 10, 0]],
    ['two small cells that differ: no derivation', 26, [12, 8, 3, 3, 0], [12, 8, '<k', '<k', 0]],
    ['one small cell: the 0 is hidden too', 18, [12, 5, 1, 0], [12, 5, '<k', '<k']],
    [
      'one small cell: every 0 is hidden, not only the first',
      20,
      [12, 0, 6, 2, 0],
      [12, '<k', 6, '<k', '<k'],
    ],
    ['two cells of 1: each would be 1, so the 0 is hidden too', 22, [20, 1, 1, 0], [20, '<k', '<k', '<k']],
    [
      'two cells of k − 1: each would be k − 1, so the 0 is hidden too',
      28,
      [20, 4, 4, 0],
      [20, '<k', '<k', '<k'],
    ],
    ['no 0: the smallest shown is hidden too', 21, [12, 6, 3], [12, '<k', '<k']],
    ['no 0: each next count within k of the last hidden one too', 23, [9, 6, 6, 2], ['<k', '<k', '<k', '<k']],
    ['a small total hides every cell, a 0 too', 4, [3, 1, 0], ['<k', '<k', '<k']],
    ['nobody answered', 0, [0, 0, 0], [0, 0, 0]],
  ])('[INS-006] %s', (_name, total, counts, expected) => {
    expect(values(additiveGroupCells(k5, total, counts))).toEqual(expected);
  });

  it('[INS-006] hides the next-smallest cell when one hidden count equals the total minus the shown ones', () => {
    // Arrange: 12 + 8 + 2 + 0 = 22; showing 12, 8 and 0 would reveal the 2.
    const counts = [12, 8, 2, 0];
    // Act
    const cells = additiveGroupCells(k5, 22, counts);
    // Assert
    expect(values(cells)).toEqual([12, 8, '<k', '<k']);
    expect(cells.filter((cell) => cell.suppressed)).toHaveLength(2);
  });
});

describe('[INS-006] parts with totals known from elsewhere', () => {
  it('[INS-006] protects each part with its own total, and hides everything when the whole total is small', () => {
    // Act: a right option of 12 and wrong options 5, 1 and «no answer» 0, whose total 6 INS-002 reveals.
    const cells = partitionedGroupCells(k5, 18, [12, 5, 1, 0], [[0], [1, 2, 3]]);
    // Assert
    expect(values(cells)).toEqual([12, 5, '<k', '<k']);
    expect(values(partitionedGroupCells(k5, 4, [3, 1, 0], [[0], [1, 2]]))).toEqual(['<k', '<k', '<k']);
    expect(values(partitionedGroupCells(k5, 7, [6, 1, 0], [[0], [1, 2]]))).toEqual([6, '<k', '<k']);
  });

  it('[INS-006] suppresses every cell of a report part and keeps its texts and "not available"', () => {
    const part = { text: 'Q', learners: countCell(k5, 0), rate: null, list: [{ cell: countCell(k5, 9) }] };
    expect(suppressEveryCell(part)).toEqual({
      text: 'Q',
      learners: { suppressed: true },
      rate: null,
      list: [{ cell: { suppressed: true } }],
    });
  });
});
