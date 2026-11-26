/**
 * Tests that a save cuts a list to the most items its field allows (D-126), as H5P's own server software does:
 * lists of groups, of sub-content and of numbers; that a refusal inside the items past the maximum is still
 * heard; and that a long list of numbers is written back whole.
 *
 * Spec: SEC-008, SEC-005
 */
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const MAIN = { machineName: 'H5P.Shelf', majorVersion: 1, minorVersion: 0 };
const LIBRARIES = [
  {
    machineName: 'H5P.Shelf',
    runnable: true,
    semantics: [
      {
        name: 'chapters',
        type: 'list',
        min: 1,
        max: 3,
        field: { name: 'chapter', type: 'library', options: ['H5P.Page 1.0'] },
      },
      {
        name: 'notes',
        type: 'list',
        max: 2,
        field: {
          name: 'note',
          type: 'group',
          fields: [
            { name: 'text', type: 'text' },
            { name: 'page', type: 'number' },
          ],
        },
      },
      { name: 'weights', type: 'list', max: 4, field: { name: 'weight', type: 'number' } },
      { name: 'scores', type: 'list', field: { name: 'score', type: 'number' } },
    ],
  },
  { machineName: 'H5P.Page', semantics: [{ name: 'text', type: 'text' }] },
];
const policy = () =>
  new SubContentPolicy(
    new LibraryManager(new fsImplementations.FileLibraryStorage(syntheticLibraryDir(LIBRARIES))),
  );
const chapter = (text: string, library = 'H5P.Page 1.0') => ({ library, params: { text } });
const note = (page: number) => ({ text: `Notat ${String(page)}`, page });

describe('[SEC-008] a list holds at most the items its field allows', () => {
  it('[SEC-008] a list at its maximum is stored as it came', async () => {
    // Arrange
    const params = {
      chapters: [chapter('Ein'), chapter('To'), chapter('Tre')],
      notes: [note(1), note(2)],
      weights: [1, 2, 3, 4],
    };
    const before = structuredClone(params);
    // Act
    const changed = await policy().enforce(params, {}, MAIN);
    // Assert
    expect(changed).toBe(0);
    expect(params).toEqual(before);
  });

  it('[SEC-008] a list past its maximum keeps its first items: sub-content, groups and numbers alike', async () => {
    // Arrange
    const params = {
      chapters: [chapter('Ein'), chapter('To'), chapter('Tre'), chapter('Fire'), chapter('Fem')],
      notes: [note(1), note(2), note(3)],
      weights: [1, 2, 3, 4, 5, 6],
    };
    // Act
    const changed = await policy().enforce(params, {}, MAIN);
    // Assert
    expect(changed).toBe(3);
    expect(params.chapters.map((item) => item.params.text)).toEqual(['Ein', 'To', 'Tre']);
    expect(params.notes).toEqual([note(1), note(2)]);
    expect(params.weights).toEqual([1, 2, 3, 4]);
  });

  it('[SEC-008] numbers are fitted among the items the maximum keeps, not among those it cuts', async () => {
    // Arrange: the second of the first four is no number
    const params = { weights: [1, 'x', 3, 4, 5, 6] };
    // Act
    await policy().enforce(params, {}, MAIN);
    // Assert
    expect(params.weights).toEqual([1, 3, 4]);
  });

  it('[H5P-002] a piece its field does not offer refuses the save also among the items past the maximum', async () => {
    // Arrange
    const chapters = [chapter('Ein'), chapter('To'), chapter('Tre'), chapter('Fire', 'H5P.Other 1.0')];
    const params = { chapters };
    const before = structuredClone(params);
    // Act
    const refused = await policy()
      .enforce(params, {}, MAIN)
      .catch((error: unknown) => error);
    // Assert
    expect(refused).toMatchObject({ errorId: 'hvl:sub-content-not-allowed', httpStatusCode: 403 });
    expect(params).toEqual(before);
  });

  it('[SEC-005] a long list of numbers with one that does not fit is written back whole, without it', async () => {
    // Arrange: 150 000 numbers, more than one call can take as arguments
    const scores: unknown[] = Array.from({ length: 150_000 }, (_, at) => at);
    scores[10] = 'ti';
    const params = { scores };
    // Act
    const changed = await policy().enforce(params, {}, MAIN);
    // Assert
    expect(changed).toBe(1);
    expect(params.scores).toHaveLength(149_999);
    expect(params.scores.slice(9, 12)).toEqual([9, 11, 12]);
  });
});
