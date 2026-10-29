/**
 * Unit tests of the mark that makes the content storage reset learner state with a structural save's first
 * parameter write (D-093 amendment 2026-10-29, S5 review).
 *
 * Spec: PROD-013
 */
import { describe, expect, it } from 'vitest';
import {
  claimLearnerStateReset,
  withLearnerStateReset,
} from '../../src/h5p/storage/learnerStateResetWrite.js';

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('[PROD-013] the learner-state reset of a save’s first write', () => {
  it('[PROD-013] is claimed once, by a write of the marked activity, across awaits', async () => {
    // Arrange
    const claims: boolean[] = [];
    // Act
    const { result, claimed } = await withLearnerStateReset('c1', async () => {
      claims.push(claimLearnerStateReset('other'));
      await tick();
      claims.push(claimLearnerStateReset('c1'), claimLearnerStateReset('c1'));
      return 'saved';
    });
    // Assert
    expect({ result, claimed, claims }).toEqual({
      result: 'saved',
      claimed: true,
      claims: [false, true, false],
    });
  });

  it('[PROD-013] is never claimed outside a marked save, nor by another save running at the same time', async () => {
    // Arrange
    const outside = claimLearnerStateReset('c1');
    // Act
    const [marked, unmarked] = await Promise.all([
      withLearnerStateReset('c1', async () => {
        await tick();
        return 'marked';
      }),
      (async () => {
        await tick();
        return claimLearnerStateReset('c1');
      })(),
    ]);
    // Assert
    expect({ outside, marked, unmarked }).toEqual({
      outside: false,
      marked: { result: 'marked', claimed: false },
      unmarked: false,
    });
  });

  it('[PROD-013] passes the save’s rejection on', async () => {
    // Arrange
    const failing = withLearnerStateReset('c1', async () => {
      claimLearnerStateReset('c1');
      throw new Error('the write failed');
    });
    // Act and assert
    await expect(failing).rejects.toThrow('the write failed');
  });
});
