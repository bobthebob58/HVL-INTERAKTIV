/**
 * semanticDefaultsLibraries — two made-up libraries (`H5P.Main 1.0`, `H5P.Sub 1.0`) with semantics and a Nynorsk
 * language file, served as Lumi's library manager would serve them, for the semantics-defaults unit tests.
 *
 * Why: the unit tests need every field shape the filler handles (text, list of groups, a group of one field, a
 *      sub-content group, library fields with and without a default, a group without defaults, labels) without the
 *      real libraries; the real ones are covered by probe P1.
 * Spec: PED-010
 * Invariants: `getSemantics` returns the fixture objects themselves (not copies), so a result that shares an object
 *   with the semantics would change them and show in the next call; `getLanguage` has only `nn`.
 * Collaborators: ./semanticDefaults.test.ts.
 * Tests: apps/server/test/learningDesign/patterns/semanticDefaults.test.ts
 */
import type { ILibraryName } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import type { SemanticsSource } from '../../../src/learningDesign/patterns/semanticDefaults.js';

/** A sub-content library: a text and a group of labels. */
export const SUB: ISemanticsEntry[] = [
  { name: 'question', type: 'text' },
  {
    name: 'UI',
    type: 'group',
    fields: [
      { name: 'submit', type: 'text', default: 'Submit' },
      { name: 'more', type: 'text', default: 'More' },
    ],
  },
] as ISemanticsEntry[];

/** A main library with every field shape the filler handles. */
const MAIN = [
  { name: 'title', type: 'text', default: 'Title' },
  {
    name: 'items',
    type: 'list',
    field: {
      name: 'item',
      type: 'group',
      fields: [
        { name: 'label', type: 'text', default: 'Item' },
        { name: 'done', type: 'boolean', default: false },
      ],
    },
  },
  {
    name: 'feedback',
    type: 'group',
    fields: [
      {
        name: 'ranges',
        type: 'list',
        field: {
          name: 'range',
          type: 'group',
          fields: [
            { name: 'from', type: 'number', default: 0 },
            { name: 'to', type: 'number', default: 100 },
          ],
        },
      },
    ],
  },
  {
    name: 'statements',
    type: 'list',
    field: { name: 'statement', type: 'group', isSubContent: true, fields: [{ name: 'text', type: 'text' }] },
  },
  { name: 'task', type: 'library', options: ['H5P.Sub 1.0'] },
  {
    name: 'summary',
    type: 'library',
    options: ['H5P.Sub 1.0'],
    default: { library: 'H5P.Sub 1.0', params: {} },
  },
  {
    name: 'empty',
    type: 'group',
    fields: [
      { name: 'a', type: 'text' },
      { name: 'b', type: 'text' },
    ],
  },
  {
    name: 'l10n',
    type: 'group',
    fields: [
      { name: 'check', type: 'text', default: 'Check' },
      { name: 'retry', type: 'text', default: 'Retry' },
    ],
  },
] as unknown as ISemanticsEntry[];

const LIBRARIES: Record<string, { semantics: ISemanticsEntry[]; nn: unknown[] }> = {
  'H5P.Main 1.0': {
    semantics: MAIN,
    nn: [{ default: 'Tittel' }, {}, {}, {}, {}, {}, {}, { fields: [{ default: 'Sjekk' }] }],
  },
  'H5P.Sub 1.0': { semantics: SUB, nn: [{}, { fields: [{ default: 'Send inn' }] }] },
};

/**
 * Lumi's library manager as the filler sees it; returns the fixtures themselves, so sharing would show.
 * @returns The source, with the calls it received in order.
 */
export function librarySource(): SemanticsSource & { calls: string[] } {
  const calls: string[] = [];
  const key = (l: ILibraryName) => `${l.machineName} ${l.majorVersion}.${l.minorVersion}`;
  return {
    calls,
    getSemantics: async (library) => {
      calls.push(`semantics ${key(library)}`);
      const found = LIBRARIES[key(library)];
      if (!found) throw new Error(`${key(library)} is not installed`);
      return found.semantics;
    },
    getLanguage: async (library, language) => {
      calls.push(`language ${key(library)} ${language}`);
      const file = language === 'nn' ? LIBRARIES[key(library)]?.nn : undefined;
      return file ? JSON.stringify({ semantics: file }) : null;
    },
  };
}
