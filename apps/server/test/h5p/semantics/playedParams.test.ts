/**
 * Unit tests of the parameters the player page carries (D-124): a model's `jsonContent` is fitted to its library's
 * semantics, parameters that need no fix keep their exact text, the model handed in is not changed, and a row the
 * walker cannot read fails the render.
 *
 * Spec: SEC-008, H5P-004
 */
import { LibraryManager, fsImplementations, type IPlayerModel } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { withFittedContents } from '../../../src/h5p/semantics/playedParams.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';
import { MARKUP, UNDECLARED_KEY, withUndeclaredKeys } from '../../support/undeclaredKeys.js';

afterAll(removeSyntheticLibraryDirs);

const LIBRARIES = [
  {
    machineName: 'H5P.Fit',
    runnable: true,
    semantics: [
      { name: 'title', type: 'text' },
      { name: 'passPercentage', type: 'number', min: 0, max: 100 },
      {
        name: 'overallFeedback',
        type: 'group',
        fields: [{ name: 'overallFeedback', type: 'list', field: { name: 'f', type: 'text' } }],
      },
      { name: 'task', type: 'library', options: ['H5P.Part 1.0'] },
    ],
  },
  { machineName: 'H5P.Part', semantics: [{ name: 'question', type: 'text' }] },
];
const manager = new LibraryManager(new fsImplementations.FileLibraryStorage(syntheticLibraryDir(LIBRARIES)));
const lookup = (library: Parameters<LibraryManager['getSemantics']>[0]) => manager.getSemantics(library);
const genuine = () => ({
  title: 'Celler',
  passPercentage: 50,
  overallFeedback: ['Bra'],
  task: {
    library: 'H5P.Part 1.0',
    params: { question: 'Kva?' },
    subContentId: '5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  },
});
/** A player model as Lumi builds it, with the parts this module reads. */
const modelOf = (params: unknown, library = 'H5P.Fit 1.0') =>
  ({
    contentId: 'c1',
    integration: {
      contents: { 'cid-c1': { library, jsonContent: JSON.stringify(params), fullScreen: '0' } },
    },
  }) as unknown as IPlayerModel;
const played = (model: IPlayerModel) =>
  (model.integration.contents as Record<string, { jsonContent: string; fullScreen: string }>)['cid-c1'];

describe('[SEC-008] the parameters the player page carries', () => {
  it('[SEC-008] hold nothing the semantics do not describe, whatever the stored row holds', async () => {
    // Arrange: an unknown key in every object, and a number written as markup
    const stored = { ...withUndeclaredKeys(genuine()), passPercentage: MARKUP };
    const model = modelOf(stored);
    // Act
    const fitted = await withFittedContents(model, lookup);
    // Assert: fitted in the copy, with the rest of the content entry kept; the model handed in is as it was
    const { passPercentage: _removed, ...expected } = genuine();
    expect(JSON.parse(played(fitted)?.jsonContent ?? '')).toEqual(expected);
    expect(played(fitted)?.fullScreen).toBe('0');
    expect(played(model)?.jsonContent).toContain(UNDECLARED_KEY);
  });

  it('[H5P-004] parameters that need no fix keep their exact text', async () => {
    // Arrange: text whose JSON form a round trip would not keep (spacing)
    const model = modelOf(genuine());
    const spaced = JSON.stringify(genuine(), null, 2);
    (model.integration.contents as Record<string, { jsonContent: string }>)['cid-c1']!.jsonContent = spaced;
    // Act
    const fitted = await withFittedContents(model, lookup);
    // Assert
    expect(played(fitted)?.jsonContent).toBe(spaced);
  });

  it('[SEC-008] a row that cannot be read as its semantics describe fails the render with 400', async () => {
    // Arrange: an object where the single-field group holds a list
    const model = modelOf({ ...genuine(), overallFeedback: { 0: MARKUP, length: 1 } });
    // Act and assert
    await expect(withFittedContents(model, lookup)).rejects.toMatchObject({
      errorId: 'hvl:invalid-params',
      httpStatusCode: 400,
    });
  });

  it('[H5P-004] a model without content, or with content it cannot read, is handed on as it is', async () => {
    // Arrange
    const empty = { contentId: 'c1', integration: {} } as unknown as IPlayerModel;
    const text = modelOf('not an object');
    // Act and assert
    expect(await withFittedContents(empty, lookup)).toBe(empty);
    expect(played(await withFittedContents(text, lookup))?.jsonContent).toBe('"not an object"');
  });
});
