/**
 * Tests for the editor's library and download rules: no Hub installs, downloads checked by our permissions.
 *
 * Spec: H5P-011, H5P-006
 */
import { describe, it, expect, afterAll } from 'vitest';
import { Writable } from 'node:stream';
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
  ],
};
const LIBS = [MC];
const META = { title: 'Aktivitet', license: 'U', language: 'nn' } as unknown as IContentMetadata;

describe('[H5P-011] library changes and downloads', () => {
  it('[H5P-011] refuses to install from the Hub or the Content Hub, also for admins', async () => {
    const { editor, user } = await editorTestbed(LIBS);
    await expect(editor.installLibraryFromHub('H5P.Blanks', user('admin'))).rejects.toMatchObject({
      errorId: 'hvl:hub-install-disabled',
      httpStatusCode: 403,
    });
    await expect(editor.getContentHubContent('42', user('admin'))).rejects.toMatchObject({
      httpStatusCode: 403,
    });
  });

  it('[H5P-006] a download asks our permission system for Download', async () => {
    // Arrange
    const testbed = await editorTestbed(LIBS);
    const author = testbed.user('author');
    const id = await testbed.editor.saveOrUpdateContent(
      undefined,
      { question: 'Q', answers: [] },
      META,
      'H5P.MultiChoice 1.16',
      author,
    );
    testbed.permissions.overrides.Download = false;
    const sink = new Writable({ write: (_chunk, _encoding, done) => done() });
    // Act: a download the permission system refuses
    await expect(testbed.editor.exportContent(id, sink, author)).rejects.toBeDefined();
    // Assert
    expect(testbed.permissions.calls).toContainEqual({
      kind: 'content',
      permission: 'Download',
      role: 'author',
    });
  });
});
