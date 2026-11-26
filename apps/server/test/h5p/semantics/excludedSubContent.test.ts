/**
 * Tests of which types are accepted as sub-content (D-123): H5P.AudioRecorder, H5P.TwitterUserFeed and
 * H5P.Questionnaire are offered by no container and refused on save, like H5P.DragQuestion; the six other types the
 * containers offer beside the ten stay, in the editor's choices and on save, also with the real libraries.
 *
 * Spec: H5P-002
 */
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { afterAll, describe, expect, it } from 'vitest';
import { HVL_TOP10_CONTENT_TYPES } from '../../../src/h5p/HvlTop10ContentTypeFilter.js';
import {
  EXCLUDED_SUB_CONTENT,
  optionMachineName,
  removeDragQuestion,
} from '../../../src/h5p/semantics/removeDragQuestion.js';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { PINNED_LIBRARIES_DIR } from '../../../src/learningDesign/content/installedLibraries.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const REFUSED = ['H5P.AudioRecorder', 'H5P.TwitterUserFeed', 'H5P.Questionnaire'];
const KEPT = [
  'H5P.TrueFalse',
  'H5P.SingleChoiceSet',
  'H5P.MarkTheWords',
  'H5P.Summary',
  'H5P.MultiMediaChoice',
  'H5P.Dialogcards',
];
const MAIN = { machineName: 'H5P.Box', majorVersion: 1, minorVersion: 0 };
const OPTIONS = [...REFUSED, ...KEPT].map((name) => `${name} 1.0`);
const LIBRARIES = [
  {
    machineName: 'H5P.Box',
    runnable: true,
    semantics: [
      { name: 'content', type: 'list', field: { name: 'item', type: 'library', options: OPTIONS } },
    ],
  },
  ...[...REFUSED, ...KEPT].map((machineName) => ({ machineName, semantics: [] })),
];
const manager = (alter: boolean) =>
  new LibraryManager(
    new fsImplementations.FileLibraryStorage(syntheticLibraryDir(LIBRARIES)),
    undefined,
    alter ? removeDragQuestion : undefined,
  );
/** The machine names every `library` field of the semantics offers, at any depth. */
const offered = (entries: readonly ISemanticsEntry[]): string[] =>
  entries.flatMap((entry) => [
    ...(entry.type === 'library' ? (entry.options ?? []).map((o) => optionMachineName(o) ?? '') : []),
    ...offered(entry.fields ?? []),
    ...offered(entry.field ? [entry.field] : []),
  ]);

describe('[H5P-002] the types accepted as sub-content', () => {
  it('[H5P-002] the editor is offered the six kept types and none of the three refused ones', async () => {
    // Act
    const choices = offered(await manager(true).getSemantics(MAIN));
    // Assert
    expect(choices.sort()).toEqual([...KEPT].sort());
    expect([...EXCLUDED_SUB_CONTENT].sort()).toEqual(['H5P.DragQuestion', ...REFUSED].sort());
  });

  it.each(REFUSED)(
    '[H5P-002] a save that carries %s as a piece is refused, also when the semantics still offer it',
    async (machineName) => {
      for (const alter of [true, false]) {
        // Arrange
        const params = { content: [{ library: `${machineName} 1.0`, params: {} }] };
        // Act and assert
        await expect(new SubContentPolicy(manager(alter)).enforce(params, {}, MAIN)).rejects.toMatchObject({
          errorId: 'hvl:sub-content-not-allowed',
          httpStatusCode: 403,
          replacements: { library: machineName },
        });
      }
    },
  );

  it('[H5P-002] a save that carries the six kept types as pieces is accepted', async () => {
    // Arrange
    const params = { content: KEPT.map((name) => ({ library: `${name} 1.0`, params: {} })) };
    // Act
    const changed = await new SubContentPolicy(manager(true)).enforce(params, {}, MAIN);
    // Assert
    expect(changed).toBe(0);
    expect(params.content).toHaveLength(KEPT.length);
  });
});

describeWithRealPackages('[H5P-002] sub-content with the real libraries', () => {
  it('[H5P-002] no field of the ten types or of their pieces offers a refused type, and each kept type is still offered', async () => {
    // Arrange: the pinned libraries with the editor's alteration
    const libraries = new LibraryManager(
      new fsImplementations.FileLibraryStorage(PINNED_LIBRARIES_DIR),
      undefined,
      removeDragQuestion,
    );
    const installed = await libraries.listInstalledLibraries();
    // Act: follow the choices from the ten types through every piece they lead to
    const seen = new Set<string>();
    const pending = [...HVL_TOP10_CONTENT_TYPES];
    for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
      const library = installed[name]?.at(-1);
      if (seen.has(name) || !library) continue;
      seen.add(name);
      pending.push(...offered(await libraries.getSemantics(library)));
    }
    // Assert
    expect([...seen].filter((name) => ['H5P.DragQuestion', ...REFUSED].includes(name))).toEqual([]);
    expect(KEPT.filter((name) => !seen.has(name))).toEqual([]);
  });
});
