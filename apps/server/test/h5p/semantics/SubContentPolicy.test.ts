/**
 * Tests for the save-time sub-content policy: allowed libraries, DragQuestion and sanitised list items and titles.
 *
 * Spec: H5P-002, SEC-008
 */
import { describe, it, expect, afterAll } from 'vitest';
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import { SemanticsEnforcer } from '../../../src/h5p/lumiInternals.js';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { removeDragQuestion } from '../../../src/h5p/semantics/removeDragQuestion.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const XSS = '<img src=x onerror=alert(1)>Svar';
const MAIN = { machineName: 'H5P.QSet', majorVersion: 1, minorVersion: 0 };
const LIBRARIES = [
  {
    machineName: 'H5P.QSet',
    runnable: true,
    semantics: [
      { name: 'introduction', type: 'text', tags: ['strong'] },
      { name: 'notes', type: 'list', field: { name: 'note', type: 'text' } },
      {
        name: 'questions',
        type: 'list',
        field: { name: 'q', type: 'library', options: ['H5P.MultiChoice 1.16', 'H5P.DragQuestion 1.14'] },
      },
    ],
  },
  {
    machineName: 'H5P.MultiChoice',
    minorVersion: 16,
    semantics: [{ name: 'answers', type: 'list', field: { name: 'answer', type: 'text', tags: ['strong'] } }],
  },
  { machineName: 'H5P.DragQuestion', minorVersion: 14 },
];

const manager = (alter = true) =>
  new LibraryManager(
    new fsImplementations.FileLibraryStorage(syntheticLibraryDir(LIBRARIES)),
    undefined,
    alter ? removeDragQuestion : undefined,
  );

const question = (library: string, answers: string[] = ['ok'], title = 'Q') => ({
  library,
  params: { answers },
  metadata: { title },
  subContentId: 'a1b2',
});

describe('[H5P-002] sub-content rules on save', () => {
  it('[H5P-002] refuses H5P.DragQuestion as a list item, also when the semantics still offer it', async () => {
    for (const alter of [true, false]) {
      const params = { questions: [question('H5P.MultiChoice 1.16'), question('H5P.DragQuestion 1.14')] };
      await expect(new SubContentPolicy(manager(alter)).enforce(params, {}, MAIN)).rejects.toMatchObject({
        errorId: 'hvl:sub-content-not-allowed',
        httpStatusCode: 403,
        replacements: { library: 'H5P.DragQuestion' },
      });
    }
  });

  it('[H5P-002] refuses libraries and versions a field does not offer', async () => {
    for (const library of ['H5P.TrueFalse 1.8', 'H5P.MultiChoice 1.15', 'nonsense']) {
      const params = { questions: [question(library)] };
      await expect(new SubContentPolicy(manager()).enforce(params, {}, MAIN)).rejects.toMatchObject({
        httpStatusCode: 403,
      });
    }
    await expect(
      new SubContentPolicy(manager()).enforce({ questions: [question('H5P.MultiChoice 1.16')] }, {}, MAIN),
    ).resolves.toBeUndefined();
  });
});

describe('[SEC-008] text that Lumi does not sanitise', () => {
  it('[SEC-008] sanitises list-item text at the top level and inside sub-content', async () => {
    const params = {
      notes: [XSS],
      questions: [question('H5P.MultiChoice 1.16', [XSS, '<strong>riktig</strong><script>x()</script>'])],
    };
    await new SubContentPolicy(manager()).enforce(params, {}, MAIN);
    const answers = params.questions[0]?.params.answers ?? [];
    for (const text of [...params.notes, ...answers]) {
      expect(text).not.toMatch(/onerror|<img|<script/);
    }
    expect(answers[1]).toBe('<strong>riktig</strong>');
  });

  it('[SEC-008] sanitises the titles of the content and of each sub-content', async () => {
    const metadata = { title: `${XSS}</script>`, license: 'U', source: 'https://example.org/?a=1&b=2' };
    const params = { questions: [question('H5P.MultiChoice 1.16', ['ok'], XSS)] };
    await new SubContentPolicy(manager()).enforce(params, metadata, MAIN);
    expect(metadata.title).not.toMatch(/onerror|<img|<\/script/);
    expect(metadata.source).toBe('https://example.org/?a=1&b=2');
    expect(params.questions[0]?.metadata.title).not.toMatch(/onerror|<img/);
  });

  it('[SEC-008] together with Lumi enforcer, no text in the content can carry script', async () => {
    const lumi = manager();
    const params = {
      introduction: XSS,
      notes: [XSS],
      questions: [question('H5P.MultiChoice 1.16', [XSS])],
    };
    await new SubContentPolicy(lumi).enforce(params, {}, MAIN);
    await new SemanticsEnforcer(lumi).enforceSemanticStructure(params, MAIN);
    expect(JSON.stringify(params)).not.toMatch(/onerror|<img|<script/);
  });
});
