/**
 * Tests that a save keeps only what the library's semantics describe (D-123): keys no field list names are removed
 * at every level, numbers, booleans and selects get their field's type, a single-field group has one form, and a
 * refused save is left as it came.
 *
 * Spec: SEC-008, H5P-002
 */
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const MAIN = { machineName: 'H5P.Fit', majorVersion: 1, minorVersion: 0 };
const RANGE = {
  name: 'range',
  type: 'group',
  fields: [
    { name: 'from', type: 'number' },
    { name: 'to', type: 'number' },
    { name: 'feedback', type: 'text' },
  ],
};
const LIBRARIES = [
  {
    machineName: 'H5P.Fit',
    runnable: true,
    semantics: [
      { name: 'title', type: 'text' },
      { name: 'passPercentage', type: 'number', min: 0, max: 100 },
      { name: 'retry', type: 'boolean' },
      { name: 'mode', type: 'select', options: [{ value: 'auto' }, { value: 'manual' }] },
      { name: 'weights', type: 'list', field: { name: 'weight', type: 'number' } },
      {
        name: 'behaviour',
        type: 'group',
        fields: [
          { name: 'enableRetry', type: 'boolean' },
          { name: 'label', type: 'text' },
        ],
      },
      // WHY: a group with one field, stored as that field's value (H5P's overallFeedback has this shape).
      {
        name: 'overallFeedback',
        type: 'group',
        fields: [{ name: 'overallFeedback', type: 'list', field: RANGE }],
      },
      { name: 'task', type: 'library', options: ['H5P.Part 1.0'] },
    ],
  },
  {
    machineName: 'H5P.Part',
    semantics: [
      { name: 'question', type: 'text' },
      { name: 'tries', type: 'number', min: 1 },
    ],
  },
];
const ID = '5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const policy = () =>
  new SubContentPolicy(
    new LibraryManager(new fsImplementations.FileLibraryStorage(syntheticLibraryDir(LIBRARIES))),
  );
/** Content as the editor writes it: every value of its field's type, no other key. */
const genuine = () => ({
  title: 'Celler',
  passPercentage: 50,
  retry: true,
  mode: 'manual',
  weights: [1, 2],
  behaviour: { enableRetry: false, label: 'Prøv igjen' },
  overallFeedback: [{ from: 0, to: 100, feedback: 'Bra' }],
  task: {
    library: 'H5P.Part 1.0',
    params: { question: 'Kva er ei celle?', tries: 2 },
    subContentId: ID,
    metadata: { title: 'Del' },
  },
});
const MARKUP = '<img src=x onerror=alert(1)>';

describe('[SEC-008] a save keeps only what the semantics describe', () => {
  it('[SEC-008] content as the editor writes it is stored unchanged', async () => {
    // Arrange
    const params = genuine();
    // Act
    const changed = await policy().enforce(params, {}, MAIN);
    // Assert
    expect(changed).toBe(0);
    expect(params).toEqual(genuine());
  });

  it('[SEC-008] removes every key no field list names: at the top, in a group, in a list item, in a piece and in its parameters', async () => {
    // Arrange: the same content with one more key at each level
    const params = genuine() as Record<string, unknown> & ReturnType<typeof genuine>;
    params.userAnswers = [MARKUP];
    Object.assign(params.behaviour, { a11yHeader: MARKUP });
    Object.assign(params.overallFeedback[0] ?? {}, { title: MARKUP });
    Object.assign(params.task, { contentName: MARKUP });
    Object.assign(params.task.params, { l10n: { name: MARKUP } });
    // Act
    const changed = await policy().enforce(params, {}, MAIN);
    // Assert
    expect(changed).toBe(5);
    expect(params).toEqual(genuine());
    expect(JSON.stringify(params)).not.toContain('onerror');
  });

  it('[SEC-008] a number is a finite number within its bounds, a boolean a boolean and a select one of its options', async () => {
    // Arrange
    const params = {
      ...genuine(),
      passPercentage: '80',
      retry: 'true',
      mode: MARKUP,
      weights: [1, '2', MARKUP, null],
      behaviour: { enableRetry: 1, label: 'Prøv igjen' },
      task: { library: 'H5P.Part 1.0', params: { question: 'Kva?', tries: -3 }, subContentId: ID },
    };
    // Act
    await policy().enforce(params, {}, MAIN);
    // Assert: fitted where the value says what it means, removed where it does not
    expect(params.passPercentage).toBe(80);
    expect(params).not.toHaveProperty('retry');
    expect(params).not.toHaveProperty('mode');
    expect(params.weights).toEqual([1, 2]);
    expect(params.behaviour).toEqual({ label: 'Prøv igjen' });
    expect(params.task.params.tries).toBe(1);
  });

  it('[SEC-008] a number above its maximum is brought down to it, and markup in a number field is removed', async () => {
    // Arrange
    const over = { ...genuine(), passPercentage: 250 };
    const text = { ...genuine(), passPercentage: MARKUP };
    // Act
    await policy().enforce(over, {}, MAIN);
    await policy().enforce(text, {}, MAIN);
    // Assert
    expect(over.passPercentage).toBe(100);
    expect(text).not.toHaveProperty('passPercentage');
  });

  it('[H5P-002] a piece keeps its sub-content ID only when it is a UUID, and its metadata only when it is an object', async () => {
    // Arrange
    const params = genuine();
    Object.assign(params.task, { subContentId: `"${MARKUP}`, metadata: MARKUP });
    // Act
    await policy().enforce(params, {}, MAIN);
    // Assert
    expect(Object.keys(params.task).sort()).toEqual(['library', 'params']);
  });

  it('[SEC-008] a single-field group is the field’s value: a list that is no real list is refused', async () => {
    // Arrange: an object that only looks like a list, as the player would still read it
    const feedback = { 0: { from: 0, to: 100, feedback: MARKUP }, length: 1 };
    const lookalike = { ...genuine(), overallFeedback: feedback };
    const secondForm = { ...genuine(), overallFeedback: { overallFeedback: [], ...feedback } };
    // Act and assert
    for (const params of [lookalike, secondForm]) {
      await expect(policy().enforce(params, {}, MAIN)).rejects.toMatchObject({
        errorId: 'hvl:invalid-params',
        httpStatusCode: 400,
      });
    }
  });

  it('[SEC-008] a refused save is left as it came: nothing is removed before every refusal has had its say', async () => {
    // Arrange: a key to remove, and a piece its field does not offer
    const params = { ...genuine(), extra: MARKUP, task: { library: 'H5P.Other 1.0', params: {} } };
    const before = structuredClone(params);
    // Act
    const refused = await policy()
      .enforce(params, {}, MAIN)
      .catch((error: unknown) => error);
    // Assert
    expect(refused).toMatchObject({ errorId: 'hvl:sub-content-not-allowed', httpStatusCode: 403 });
    expect(params).toEqual(before);
  });
});
