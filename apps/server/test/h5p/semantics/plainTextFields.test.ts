/**
 * Unit tests of the plain-text rule at the three places content passes (D-140): a save, the player page and the
 * editor's form. A text field without a `tags` list holds no markup after any of them, in a list, outside one
 * and inside sub-content; a field with a list keeps its markup; and a row that needs nothing keeps its text.
 *
 * Spec: SEC-008, H5P-004, H5P-006
 */
import { LibraryManager, fsImplementations, type IPlayerModel } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { SemanticsEnforcer } from '../../../src/h5p/lumiInternals.js';
import { EditorFormParams } from '../../../src/h5p/semantics/editorFormParams.js';
import { withFittedContents } from '../../../src/h5p/semantics/playedParams.js';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const MAIN = { machineName: 'H5P.Plain', majorVersion: 1, minorVersion: 0 };
const LIBRARIES = [
  {
    machineName: 'H5P.Plain',
    runnable: true,
    semantics: [
      { name: 'label', type: 'text' },
      { name: 'intro', type: 'text', widget: 'html', tags: ['strong', 'a'] },
      { name: 'notes', type: 'list', field: { name: 'note', type: 'text' } },
      {
        name: 'texts',
        type: 'group',
        fields: [
          { name: 'check', type: 'text' },
          { name: 'retry', type: 'text' },
        ],
      },
      { name: 'task', type: 'library', options: ['H5P.Part 1.0'] },
    ],
  },
  { machineName: 'H5P.Part', semantics: [{ name: 'prompt', type: 'text' }] },
];
const manager = new LibraryManager(new fsImplementations.FileLibraryStorage(syntheticLibraryDir(LIBRARIES)));
const lookup = (library: Parameters<LibraryManager['getSemantics']>[0]) => manager.getSemantics(library);
const LINKED = 'Sjekk <a href="https://example.org/">svaret</a>';
const INTRO = '<strong>Les</strong> <a href="https://hvl.no/">her</a>';
const markedUp = () => ({
  label: LINKED,
  intro: INTRO,
  notes: [LINKED, 'Vanleg'],
  texts: { check: `<table><tr><td>${LINKED}</td></tr></table>`, retry: 'Prøv igjen' },
  task: {
    library: 'H5P.Part 1.0',
    params: { prompt: LINKED },
    subContentId: '5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  },
});
const plain = () => ({
  ...markedUp(),
  label: 'Sjekk svaret',
  notes: ['Sjekk svaret', 'Vanleg'],
  texts: { check: 'Sjekk svaret', retry: 'Prøv igjen' },
  task: { ...markedUp().task, params: { prompt: 'Sjekk svaret' } },
});
const modelOf = (params: unknown) =>
  ({
    contentId: 'c1',
    integration: {
      contents: { 'cid-c1': { library: 'H5P.Plain 1.0', jsonContent: JSON.stringify(params) } },
    },
  }) as unknown as IPlayerModel;
const played = (model: IPlayerModel): string =>
  (model.integration.contents as Record<string, { jsonContent: string }>)['cid-c1']?.jsonContent ?? '';

describe('[SEC-008] a text field without a tag list is plain text', () => {
  it('[SEC-008] on save: in a field, a group, a list and sub-content; a field with tags keeps its markup', async () => {
    // Arrange
    const params = markedUp();
    // Act: our policy, then Lumi's own enforcer, as a save runs them
    await new SubContentPolicy(manager).enforce(params, {}, MAIN);
    const afterPolicy = structuredClone(params);
    await new SemanticsEnforcer(manager).enforceSemanticStructure(params, MAIN);
    // Assert: plain before Lumi reads it, and Lumi changes nothing more
    expect(afterPolicy).toEqual(plain());
    // WHY: as JSON, the form a row is stored in; Lumi's enforcer leaves a stray property on a list (D-039).
    expect(JSON.parse(JSON.stringify(params))).toEqual(plain());
  });

  it('[SEC-008] on the player page: a row stored with markup in such a field is handed over without it', async () => {
    // Arrange: a row as a save before this rule could store it
    const model = modelOf(markedUp());
    // Act
    const fitted = await withFittedContents(model, lookup);
    // Assert: the copy is plain, the model handed in is as it was
    expect(JSON.parse(played(fitted))).toEqual(plain());
    expect(played(model)).toContain('<a href=\\"https://example.org/\\">');
  });

  it('[H5P-004] on the player page: a row whose plain fields hold a typed "<" keeps its exact text', async () => {
    // Arrange: `<` as a clean row holds it, and spacing a JSON round trip would not keep
    const stored = JSON.stringify({ ...plain(), label: '2 &lt; 3 &amp; "ja"' }, null, 2);
    const model = modelOf({});
    (model.integration.contents as Record<string, { jsonContent: string }>)['cid-c1']!.jsonContent = stored;
    // Act + Assert
    expect(played(await withFittedContents(model, lookup))).toBe(stored);
  });

  it('[H5P-006] in the editor form: such a field is plain, with a quote written as the editor writes it', async () => {
    // Arrange
    const params = { ...markedUp(), label: `${LINKED} "no"` };
    // Act
    await new EditorFormParams(manager).clean(params, {}, MAIN);
    // Assert
    expect(params).toEqual({ ...plain(), label: 'Sjekk svaret &quot;no&quot;' });
  });
});
