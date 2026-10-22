/**
 * Tests for removing H5P.DragQuestion from sub-content choices in the editor.
 *
 * Spec: H5P-002
 */
import { describe, it, expect } from 'vitest';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { optionMachineName, removeDragQuestion } from '../../../src/h5p/semantics/removeDragQuestion.js';

const LIB = { machineName: 'H5P.Column', majorVersion: 1, minorVersion: 18 };
const OPTIONS = [
  'H5P.MultiChoice 1.16',
  'H5P.DragQuestion 1.14',
  { name: 'H5P.DragQuestion 1.13' },
  'H5P.Text 1.1',
];

/** A container like H5P.Column/QuestionSet: a top-level field, a group, a list and a nested list. */
const SEMANTICS: ISemanticsEntry[] = [
  { name: 'single', type: 'library', options: [...OPTIONS] },
  { name: 'group', type: 'group', fields: [{ name: 'inGroup', type: 'library', options: [...OPTIONS] }] },
  { name: 'list', type: 'list', field: { name: 'item', type: 'library', options: [...OPTIONS] } },
  {
    name: 'outer',
    type: 'list',
    field: {
      name: 'chapter',
      type: 'group',
      fields: [
        { name: 'inner', type: 'list', field: { name: 'deep', type: 'library', options: [...OPTIONS] } },
      ],
    },
  },
  {
    name: 'choice',
    type: 'select',
    options: [{ value: 'H5P.DragQuestion', label: 'kept: not a library field' }],
  },
];

/** Every `options` array of a `library` field, at any depth. */
function libraryOptions(entries: ISemanticsEntry[]): unknown[][] {
  return entries.flatMap((e) => [
    ...(e.type === 'library' ? [e.options ?? []] : []),
    ...libraryOptions(e.fields ?? []),
    ...libraryOptions(e.field ? [e.field] : []),
  ]);
}

describe('[H5P-002] no container offers H5P.DragQuestion', () => {
  it('[H5P-002] removes it from library fields at the top, in groups, in lists and in nested lists', () => {
    const altered = removeDragQuestion(LIB, SEMANTICS);
    const all = libraryOptions(altered);
    expect(all).toHaveLength(4);
    for (const options of all) expect(options).toEqual(['H5P.MultiChoice 1.16', 'H5P.Text 1.1']);
  });

  it('[H5P-002] leaves other field types and the original semantics unchanged', () => {
    const before = JSON.stringify(SEMANTICS);
    const altered = removeDragQuestion(LIB, SEMANTICS);
    expect(altered[4]).toEqual(SEMANTICS[4]);
    expect(JSON.stringify(SEMANTICS)).toBe(before);
  });

  it('[H5P-002] reads machine names from string and object options', () => {
    expect(optionMachineName('H5P.DragQuestion 1.14')).toBe('H5P.DragQuestion');
    expect(optionMachineName({ name: ' H5P.Text 1.1' })).toBe('H5P.Text');
    expect(optionMachineName(42)).toBeUndefined();
  });
});
