/**
 * Unit tests of the content H5P's editor is handed (D-124): fitted to its semantics, its text cleaned as on save, a
 * quote in plain text and in title data written the way the editor writes it, rich text left alone, content that
 * cannot be read refused, and nothing changed in what a save of it stores.
 *
 * Spec: SEC-008, SEC-005, H5P-006
 */
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { editorSavedForm } from '../../../src/content/savedForm.js';
import { EditorFormParams, editorText } from '../../../src/h5p/semantics/editorFormParams.js';
import { removeDragQuestion } from '../../../src/h5p/semantics/removeDragQuestion.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';
import { MARKUP, UNDECLARED_KEY } from '../../support/undeclaredKeys.js';

afterAll(removeSyntheticLibraryDirs);

// WHY: one of the ten names, so `editorSavedForm` computes what a save stores.
const MAIN = { machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 0 };
const LIBRARIES = [
  {
    machineName: 'H5P.MultiChoice',
    runnable: true,
    semantics: [
      { name: 'question', type: 'text' },
      { name: 'body', type: 'text', widget: 'html', tags: ['strong', 'a'] },
      { name: 'labels', type: 'list', field: { name: 'label', type: 'text' } },
      { name: 'passPercentage', type: 'number' },
      { name: 'image', type: 'image' },
      { name: 'task', type: 'library', options: ['H5P.Part 1.0', 'H5P.AudioRecorder 1.0'] },
    ],
  },
  { machineName: 'H5P.Part', semantics: [{ name: 'prompt', type: 'text' }] },
  { machineName: 'H5P.AudioRecorder', semantics: [] },
];
const manager = new LibraryManager(
  new fsImplementations.FileLibraryStorage(syntheticLibraryDir(LIBRARIES)),
  undefined,
  removeDragQuestion,
);
const form = new EditorFormParams(manager);
const ID = '5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const QUOTED = 'Kva er "celle"? Ola\'s svar';
const content = () => ({
  question: QUOTED,
  body: '<strong>Les</strong> <a href="https://hvl.no/">"her"</a>',
  labels: ['"A"', 'B'],
  passPercentage: 50,
  image: { path: 'images/a.png', mime: 'image/png', copyright: { license: 'CC BY', author: 'Kari "K" Li' } },
  task: {
    library: 'H5P.Part 1.0',
    params: { prompt: QUOTED },
    subContentId: ID,
    metadata: { title: QUOTED },
  },
});
const metadata = () => ({
  title: QUOTED,
  license: 'U',
  authors: [{ name: 'Ola "O" Nordmann', role: 'Author' }],
});

describe('[SEC-008] the content the editor is handed', () => {
  it('[H5P-006] a quote in plain text, in a list item and in title data is written as the editor writes it', async () => {
    // Arrange
    const [params, meta] = [content(), metadata()];
    // Act
    await form.clean(params, meta, MAIN);
    // Assert
    const quoted = 'Kva er &quot;celle&quot;? Ola&#039;s svar';
    expect(editorText(QUOTED)).toBe(quoted);
    expect([params.question, params.task.params.prompt, params.task.metadata.title, meta.title]).toEqual(
      Array.from({ length: 4 }, () => quoted),
    );
    expect(params.labels).toEqual(['&quot;A&quot;', 'B']);
    expect(params.image.copyright.author).toBe('Kari &quot;K&quot; Li');
    expect(meta.authors[0]?.name).toBe('Ola &quot;O&quot; Nordmann');
  });

  it('[H5P-006] rich text keeps its quotes, in an attribute and in the text', async () => {
    // Arrange
    const params = content();
    // Act
    await form.clean(params, metadata(), MAIN);
    // Assert
    expect(params.body).toContain('href="https://hvl.no/"');
    expect(params.body).toContain('"her"');
    expect(params.body).not.toContain('&quot;');
  });

  it('[SEC-008] text is cleaned as on save, keys no field names are removed and a number is a number', async () => {
    // Arrange: as an uploaded package could hold it
    const params = { ...content(), question: `x"${MARKUP}`, passPercentage: '75', [UNDECLARED_KEY]: MARKUP };
    const meta = { ...metadata(), title: `Tittel${MARKUP}` };
    // Act
    await form.clean(params, meta, MAIN);
    // Assert: no element and no plain quote is left in what goes into value="…"
    expect(params.question).toBe('x&quot;');
    expect(params.passPercentage).toBe(75);
    expect(params).not.toHaveProperty(UNDECLARED_KEY);
    expect(meta.title).toBe('Tittel');
  });

  it('[SEC-005] content that cannot be read as its semantics describe, or with an unsafe file path, is refused', async () => {
    // Arrange
    const lookalike = { ...content(), labels: { 0: MARKUP, length: 1 } };
    const unsafe = { ...content(), image: { path: 'a.png" onerror="x', mime: 'image/png' } };
    // Act and assert
    await expect(form.clean(lookalike, metadata(), MAIN)).rejects.toMatchObject({
      errorId: 'hvl:invalid-params',
      httpStatusCode: 400,
    });
    await expect(form.clean(unsafe, metadata(), MAIN)).rejects.toMatchObject({
      errorId: 'hvl:unsafe-file-path',
      httpStatusCode: 400,
    });
  });

  it('[H5P-002] a piece of a type the save refuses still opens, so the author can take it out', async () => {
    // Arrange
    const params = { ...content(), task: { library: 'H5P.AudioRecorder 1.0', params: {}, subContentId: ID } };
    // Act
    await form.clean(params, metadata(), MAIN);
    // Assert
    expect(params.task.library).toBe('H5P.AudioRecorder 1.0');
  });

  it('[H5P-006] a save of the content the editor was handed stores what a save of the stored content stores', async () => {
    // Arrange
    const savedForm = editorSavedForm(manager);
    const submitted = (params: unknown, meta: unknown) => ({
      mainLibrary: 'H5P.MultiChoice 1.0',
      params,
      metadata: meta,
    });
    const [handed, handedMeta] = [content(), metadata()];
    // Act
    await form.clean(handed, handedMeta, MAIN);
    const fromEditor = await savedForm(submitted(handed, handedMeta));
    const direct = await savedForm(submitted(content(), metadata()));
    // Assert
    expect(fromEditor).toEqual(direct);
    expect(JSON.stringify(direct)).toContain('Kva er \\"celle\\"?');
  });
});
