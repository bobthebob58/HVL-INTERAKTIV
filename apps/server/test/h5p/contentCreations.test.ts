/**
 * Unit tests of the per-operation record of created activity rows, which lets a failed duplicate remove exactly the
 * rows its own save wrote (D-092).
 *
 * Spec: PROD-007, H5P-004
 */
import { describe, expect, it } from 'vitest';
import { noteContentCreated, trackContentCreations } from '../../src/h5p/storage/contentCreations.js';

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('[PROD-007] tracking the rows an operation creates', () => {
  it('[PROD-007] collects every creation of the operation, across awaits, and returns its result', async () => {
    const created: string[] = []; // Arrange
    const result = await trackContentCreations(created, async () => {
      noteContentCreated('a'); // Act
      await tick();
      noteContentCreated('b');
      return 'saved';
    });
    expect({ result, created }).toEqual({ result: 'saved', created: ['a', 'b'] }); // Assert
  });

  it('[PROD-007] keeps the IDs when the operation rejects', async () => {
    const created: string[] = []; // Arrange
    const run = trackContentCreations(created, async () => {
      noteContentCreated('half-saved'); // Act
      await tick();
      throw new Error('second write failed');
    });
    await expect(run).rejects.toThrow('second write failed'); // Assert
    expect(created).toEqual(['half-saved']);
  });

  it('[PROD-007] concurrent operations never see each other’s rows', async () => {
    // Arrange
    const first: string[] = [];
    const second: string[] = [];
    const save = (id: string) => async () => {
      await tick();
      noteContentCreated(id);
    };
    // Act
    await Promise.all([
      trackContentCreations(first, save('mine')),
      trackContentCreations(second, save('theirs')),
    ]);
    // Assert
    expect({ first, second }).toEqual({ first: ['mine'], second: ['theirs'] });
  });

  it('[PROD-007] a creation outside any tracked operation is recorded nowhere', async () => {
    const created: string[] = []; // Arrange
    noteContentCreated('elsewhere'); // Act
    await trackContentCreations(created, async () => undefined);
    expect(created).toEqual([]); // Assert
  });
});
