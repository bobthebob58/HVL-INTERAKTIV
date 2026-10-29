/**
 * Tests for the editor rules: creatable types, save order and checks, learner-state resets, file cleanup.
 *
 * Spec: H5P-002, PROD-002, H5P-005, H5P-006, SEC-008, PROD-013
 */
import { describe, it, expect, afterAll } from 'vitest';
import { Readable } from 'node:stream';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import { editorTestbed, removeEditorTestbeds } from '../support/editorTestbed.js';
import { removeSyntheticLibraryDirs, type SyntheticLibrary } from '../support/syntheticLibraries.js';

afterAll(() => {
  removeEditorTestbeds();
  removeSyntheticLibraryDirs();
});

const MC: SyntheticLibrary = {
  machineName: 'H5P.MultiChoice',
  minorVersion: 16,
  runnable: true,
  semantics: [
    { name: 'question', type: 'text' },
    { name: 'answers', type: 'list', field: { name: 'answer', type: 'text' } },
    { name: 'media', type: 'image', optional: true },
  ],
};
const QSET: SyntheticLibrary = {
  machineName: 'H5P.QuestionSet',
  minorVersion: 21,
  runnable: true,
  semantics: [
    {
      name: 'questions',
      type: 'list',
      field: { name: 'q', type: 'library', options: ['H5P.MultiChoice 1.16', 'H5P.DragQuestion 1.14'] },
    },
  ],
};
const OTHERS: SyntheticLibrary[] = [
  { machineName: 'H5P.TrueFalse', minorVersion: 8, runnable: true },
  { machineName: 'H5P.DragQuestion', minorVersion: 14, runnable: true },
  { machineName: 'H5P.Question', minorVersion: 5 },
];
const LIBS = [MC, QSET, ...OTHERS];
const META = { title: 'Aktivitet', license: 'U', language: 'nn' } as unknown as IContentMetadata;
const XSS = '<img src=x onerror=alert(1)>svar';

describe('[H5P-002] creatable content types', () => {
  it('[H5P-002][PROD-002] lists only the installed members of the ten as creatable', async () => {
    const { editor, user } = await editorTestbed(LIBS);
    const info = await editor.getContentTypeCache(user('author'), 'nn');
    expect(info.libraries.map((l) => l.machineName).sort()).toEqual(['H5P.MultiChoice', 'H5P.QuestionSet']);
  });

  it('[H5P-002] the editor never offers H5P.DragQuestion inside a container', async () => {
    const { editor } = await editorTestbed(LIBS);
    const data = await editor.getLibraryData('H5P.QuestionSet', '1', '21', 'nn');
    expect(JSON.stringify(data.semantics)).not.toContain('H5P.DragQuestion');
  });

  it('[H5P-002] refuses to save content whose main library is not one of the ten (403)', async () => {
    const { editor, user } = await editorTestbed(LIBS);
    await expect(
      editor.saveOrUpdateContent(undefined, {}, META, 'H5P.TrueFalse 1.8', user('author')),
    ).rejects.toMatchObject({
      errorId: 'hvl:content-type-not-allowed',
      httpStatusCode: 403,
    });
  });

  it('[H5P-002] refuses H5P.DragQuestion as sub-content, also as a list item (403)', async () => {
    const { editor, user } = await editorTestbed(LIBS);
    const params = { questions: [{ library: 'H5P.DragQuestion 1.14', params: {}, subContentId: 'x' }] };
    await expect(
      editor.saveOrUpdateContent(undefined, params, META, 'H5P.QuestionSet 1.21', user('author')),
    ).rejects.toMatchObject({
      errorId: 'hvl:sub-content-not-allowed',
      httpStatusCode: 403,
    });
  });
});

describe('[H5P-006] saving', () => {
  it('[SEC-008] stores list-item text and the title without markup that could run', async () => {
    // Arrange
    const { editor, user } = await editorTestbed(LIBS);
    const author = user('author');
    // Act: save markup in the question, a list item and the title
    const id = await editor.saveOrUpdateContent(
      undefined,
      { question: XSS, answers: [XSS] },
      { ...META, title: XSS },
      'H5P.MultiChoice 1.16',
      author,
    );
    // Assert
    const stored = await editor.contentManager.getContentParameters(id, author);
    const metadata = await editor.contentManager.getContentMetadata(id, author);
    expect(JSON.stringify([stored, metadata.title])).not.toMatch(/onerror|<img/);
  });

  it('[PROD-013] a refused save and a text-only save leave learner state alone', async () => {
    // Arrange: an existing activity whose learners have state
    const testbed = await editorTestbed(LIBS);
    const author = testbed.user('author');
    const save = (id: string | undefined, question: string) =>
      testbed.editor.saveOrUpdateContent(
        id,
        { question, answers: ['Ja'] },
        META,
        'H5P.MultiChoice 1.16',
        author,
      );
    const id = await save(undefined, 'Q');
    testbed.learnerStates.othersHaveState = true;
    // Act: a save the permission system refuses, then a reworded question
    testbed.permissions.overrides.Edit = false;
    const refused = save(id, 'Q2');
    await expect(refused).rejects.toMatchObject({ httpStatusCode: 403 });
    delete testbed.permissions.overrides.Edit;
    await save(id, 'Q3');
    // Assert: no reset, not even for the new activity
    expect(testbed.learnerStates.resets).toEqual([]);
  });

  it('[PROD-013] a structural save resets learner state, and needs confirmation while others have some', async () => {
    // Arrange
    const testbed = await editorTestbed(LIBS);
    const author = testbed.user('author');
    const save = (id: string | undefined, answers: string[], confirm?: boolean) =>
      testbed.editor.saveOrUpdateContent(
        id,
        { question: 'Q', answers },
        META,
        'H5P.MultiChoice 1.16',
        author,
        {
          confirmLearnerStateReset: confirm,
        },
      );
    const id = await save(undefined, ['Ja']);
    // Act and assert: nobody else has state, so the added option resets the author's own at once
    await save(id, ['Ja', 'Nei']);
    expect(testbed.learnerStates.resets).toEqual([id]);
    // Act and assert: others have state, so the next structural save is refused until it is confirmed
    testbed.learnerStates.othersHaveState = true;
    await expect(save(id, ['Ja'])).rejects.toMatchObject({
      status: 409,
      errorCode: 'hvl:learner-state-reset-needed',
    });
    expect(await testbed.editor.contentManager.getContentParameters(id, author)).toMatchObject({
      answers: ['Ja', 'Nei'],
    });
    await save(id, ['Ja'], true);
    expect(testbed.learnerStates.resets).toEqual([id, id]);
  });

  it('[H5P-006] deletes the files an author removed from the activity', async () => {
    // Arrange: an activity with a stored image
    const { editor, user } = await editorTestbed(LIBS);
    const author = user('author');
    const media = { path: 'images/a.png', mime: 'image/png' };
    const id = await editor.saveOrUpdateContent(
      undefined,
      { question: 'Q', answers: [], media },
      META,
      'H5P.MultiChoice 1.16',
      author,
    );
    await editor.contentManager.addContentFile(
      id,
      'images/a.png',
      Readable.from([Buffer.from('png')]),
      author,
    );
    expect(await editor.contentStorage.fileExists(id, 'images/a.png')).toBe(true);
    // Act: save the activity without the image
    await editor.saveOrUpdateContent(
      id,
      { question: 'Q', answers: [] },
      META,
      'H5P.MultiChoice 1.16',
      author,
    );
    // Assert
    expect(await editor.contentStorage.fileExists(id, 'images/a.png')).toBe(false);
  });

  it('[H5P-006] learners cannot save, and a main library that is not installed is refused', async () => {
    const { editor, user } = await editorTestbed(LIBS);
    await expect(
      editor.saveOrUpdateContent(undefined, {}, META, 'H5P.MultiChoice 1.16', user('learner')),
    ).rejects.toMatchObject({ httpStatusCode: 403 });
    await expect(
      editor.saveOrUpdateContent(undefined, {}, META, 'H5P.Blanks 1.14', user('author')),
    ).rejects.toMatchObject({
      errorId: 'hvl:library-not-installed',
    });
  });
});
