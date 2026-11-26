/**
 * Unit tests of the mark that makes the content storage raise an activity's version with the first parameter write
 * of a save that changed an answer key, while the learners' state is kept (D-137).
 *
 * Spec: PROD-013, INS-003
 */
import { describe, expect, it } from 'vitest';
import {
  claimContentVersionRaise,
  withContentVersionRaise,
} from '../../src/h5p/storage/contentVersionRaiseWrite.js';
import { claimLearnerStateReset } from '../../src/h5p/storage/learnerStateResetWrite.js';

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('[PROD-013] the version raise of a save’s first write', () => {
  it('[PROD-013] is claimed once, by a write of the marked activity in any letter case, across awaits', async () => {
    // Arrange
    const claims: boolean[] = [];
    // Act
    const { result, claimed } = await withContentVersionRaise('c1', async () => {
      claims.push(claimContentVersionRaise('other'));
      await tick();
      claims.push(claimContentVersionRaise('C1'), claimContentVersionRaise('c1'));
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
    const outside = claimContentVersionRaise('c1');
    // Act
    const [marked, unmarked] = await Promise.all([
      withContentVersionRaise('c1', async () => {
        await tick();
        return 'marked';
      }),
      (async () => {
        await tick();
        return claimContentVersionRaise('c1');
      })(),
    ]);
    // Assert
    expect({ outside, marked, unmarked }).toEqual({
      outside: false,
      marked: { result: 'marked', claimed: false },
      unmarked: false,
    });
  });

  it('[PROD-013] is no learner-state reset: a save marked for a raise has no reset to claim', async () => {
    // Act
    const { result } = await withContentVersionRaise('c1', async () => claimLearnerStateReset('c1'));
    // Assert
    expect(result).toBe(false);
  });

  it('[PROD-013] passes the save’s rejection on', async () => {
    // Arrange
    const failing = withContentVersionRaise('c1', async () => {
      claimContentVersionRaise('c1');
      throw new Error('the write failed');
    });
    // Act and assert
    await expect(failing).rejects.toThrow('the write failed');
  });
});
