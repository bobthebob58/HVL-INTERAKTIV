/**
 * Property test of the save rule of D-123: whatever a save carries under keys its semantics do not name, at any
 * level, the save is either refused or stores exactly what the semantics describe.
 *
 * Spec: SEC-008
 */
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const MAIN = { machineName: 'H5P.Fit', majorVersion: 1, minorVersion: 0 };
const LIBRARIES = [
  {
    machineName: 'H5P.Fit',
    runnable: true,
    semantics: [
      { name: 'title', type: 'text' },
      { name: 'passPercentage', type: 'number' },
      {
        name: 'behaviour',
        type: 'group',
        fields: [
          { name: 'enableRetry', type: 'boolean' },
          { name: 'label', type: 'text' },
        ],
      },
      { name: 'parts', type: 'list', field: { name: 'part', type: 'library', options: ['H5P.Part 1.0'] } },
    ],
  },
  { machineName: 'H5P.Part', semantics: [{ name: 'question', type: 'text' }] },
];
const DECLARED = new Set(['title', 'passPercentage', 'behaviour', 'parts', 'enableRetry', 'label']);
const PIECE_KEYS = new Set(['library', 'params', 'subContentId', 'metadata', 'question']);
const genuine = () => ({
  title: 'Celler',
  passPercentage: 50,
  behaviour: { enableRetry: true, label: 'Prøv igjen' },
  parts: [
    {
      library: 'H5P.Part 1.0',
      params: { question: 'Kva er ei celle?' },
      subContentId: '5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
    },
  ],
});
/** A key no field list of the fixture names, and that is none of a piece's own keys. */
const unknownKey = fc
  .string({ minLength: 1, maxLength: 12 })
  .filter((key) => !DECLARED.has(key) && !PIECE_KEYS.has(key) && key !== '__proto__');
const extras = fc.dictionary(unknownKey, fc.jsonValue(), { maxKeys: 4 });

describe('[SEC-008] a save under generated unknown keys', () => {
  it('[SEC-008] is refused, or stores exactly what the semantics describe', async () => {
    const manager = new LibraryManager(
      new fsImplementations.FileLibraryStorage(syntheticLibraryDir(LIBRARIES)),
    );
    await fc.assert(
      fc.asyncProperty(extras, extras, extras, extras, async (top, group, piece, pieceParams) => {
        // Arrange: genuine content with generated keys at the top, in a group, in a piece and in its parameters
        const params = genuine();
        Object.assign(params, top);
        Object.assign(params.behaviour, group);
        Object.assign(params.parts[0] ?? {}, piece);
        Object.assign(params.parts[0]?.params ?? {}, pieceParams);
        // Act
        const outcome = await new SubContentPolicy(manager).enforce(params, {}, MAIN).then(
          () => 'stored',
          (error: { httpStatusCode?: number }) => error.httpStatusCode,
        );
        // Assert: a refusal is a 4xx (a stray library reference, an unsafe path); otherwise nothing extra is left
        if (outcome === 'stored') expect(params).toEqual(genuine());
        else expect([400, 403]).toContain(outcome);
      }),
      { numRuns: 200 },
    );
  });
});
