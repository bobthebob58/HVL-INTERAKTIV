/**
 * Tests for the editor's file rules on a save: the limit for one activity's files is checked before anything is
 * written, an upload in temporary storage counts, and a clean-up that fails after the save is stored does not
 * turn the stored save into an error (D-139).
 *
 * Spec: SEC-005, H5P-006
 */
import { Readable } from 'node:stream';
import type { ReadStream } from 'node:fs';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { ACTIVITY_FILES_OVER_LIMIT } from '../../src/h5p/activityFileBudget.js';
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
    { name: 'media', type: 'image', optional: true },
    { name: 'poster', type: 'image', optional: true },
  ],
};
const META = { title: 'Aktivitet', license: 'U', language: 'nn' } as unknown as IContentMetadata;
const MAIN = 'H5P.MultiChoice 1.16';
const image = (path: string) => ({ path, mime: 'image/png' });
const bytes = (count: number) => Readable.from([Buffer.alloc(count, 1)]);
const OVER = { errorId: ACTIVITY_FILES_OVER_LIMIT, httpStatusCode: 413 };

/** An editor with small limits and an activity that holds one stored image of `size` bytes. */
async function activityWithImage(limits: { files: number; bytes: number }, size: number) {
  const { editor, user } = await editorTestbed([MC], { fileLimits: limits });
  const author = user('author');
  const stored = { question: 'Q', media: image('images/a.png') };
  const id = await editor.saveOrUpdateContent(undefined, { question: 'Q' }, META, MAIN, author);
  await editor.contentManager.addContentFile(id, 'images/a.png', bytes(size), author);
  await editor.saveOrUpdateContent(id, stored, META, MAIN, author);
  const save = (params: object) => editor.saveOrUpdateContent(id, params, META, MAIN, author);
  return { editor, author, id, stored, save };
}

describe('[SEC-005] the editor holds a save to the limit for one activity’s files', () => {
  it('[SEC-005] refuses a save that would hold one file too many, and leaves the stored activity as it was', async () => {
    // Arrange: one file allowed, and a second one uploaded
    const { editor, author, id, stored, save } = await activityWithImage({ files: 1, bytes: 1000 }, 3);
    const upload = await editor.temporaryFileManager.addFile('b.png', bytes(3) as ReadStream, author);
    // Act
    const refused = save({ ...stored, poster: image(`${upload}#tmp`) });
    // Assert
    await expect(refused).rejects.toMatchObject(OVER);
    expect(await editor.contentManager.getContentParameters(id, author)).toEqual(stored);
    expect(await editor.contentStorage.listFiles(id, author)).toEqual(['images/a.png']);
  });

  it('[SEC-005] counts the bytes of an upload in temporary storage beside the files the activity keeps', async () => {
    // Arrange: ten bytes allowed; the kept image holds six
    const { editor, author, stored, save } = await activityWithImage({ files: 10, bytes: 10 }, 6);
    const small = await editor.temporaryFileManager.addFile('s.png', bytes(4) as ReadStream, author);
    const large = await editor.temporaryFileManager.addFile('l.png', bytes(5) as ReadStream, author);
    // Act and assert: six and five are one byte too many; six and four are the limit
    await expect(save({ ...stored, poster: image(`${large}#tmp`) })).rejects.toMatchObject(OVER);
    await expect(save({ ...stored, poster: image(`${small}#tmp`) })).resolves.toBeDefined();
  });
});

describe('[H5P-006] the clean-up after a stored save', () => {
  it('[H5P-006] that fails does not turn the stored save into an error, and is reported by its kind', async () => {
    // Arrange: the stored activity names an image that is not in storage
    const failures: string[] = [];
    const { editor, user } = await editorTestbed([MC], { onCleanupFailed: (kind) => failures.push(kind) });
    const author = user('author');
    const missing = { question: 'Q', media: image('images/gone.png') };
    const id = await editor.saveOrUpdateContent(undefined, missing, META, MAIN, author);
    // Act: a save that drops the reference, so the clean-up tries to remove the missing file
    const saved = await editor.saveOrUpdateContent(id, { question: 'Ny' }, META, MAIN, author);
    // Assert
    expect(saved).toBe(id);
    expect(await editor.contentManager.getContentParameters(id, author)).toMatchObject({ question: 'Ny' });
    expect(failures).toHaveLength(1);
  });
});
