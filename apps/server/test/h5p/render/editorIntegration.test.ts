/**
 * Tests for our editor integration: no user identity, an editor grant for an existing activity only, never valid as
 * a player's grant, an upload grant bound to the owner, both on the files origin and loaded in CORS mode, and Lumi's
 * object left unchanged.
 *
 * Spec: H5P-007, DATA-002, SEC-004
 */
import type { IIntegration } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import { ContentFileGrants } from '../../../src/h5p/contentFileGrants.js';
import { editorIntegration } from '../../../src/h5p/render/editorIntegration.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { randomKey } from '../../support/authEnv.js';

const NOW = new Date('2026-10-23T10:00:00Z');
const FILES = 'https://files.interaktiv.hvl.no';
const ring = parseKeyring(`k1=${randomKey(1)}`);
const uploads = new ContentFileGrants(ring, 'temporary-file-url');
const editorFiles = new ContentFileGrants(ring, 'editor-file-url');
const lumi = (): IIntegration =>
  ({
    user: { name: 'Kari', mail: 'kari@hvl.no', id: 'acc-1' },
    editor: { filesPath: '/h5p/temp-files', ajaxPath: '/h5p/ajax?action=' },
  }) as unknown as IIntegration;
const inputs = (contentId: string | undefined) => ({
  contentId,
  ownerId: 'acc 1',
  contentGrants: editorFiles,
  uploadGrants: uploads,
  baseUrl: '/h5p',
  filesOrigin: FILES,
  now: NOW,
});

describe('[H5P-007] editor integration', () => {
  it('[DATA-002] names nobody, whatever Lumi put in', () => {
    expect(editorIntegration(lumi(), inputs('c1')).user).toEqual({ name: '', mail: '', id: '' });
  });

  it('[SEC-004] gives an existing activity an editor-grant URL and the owner a signed upload path, both on the files origin', () => {
    // Act
    const result = editorIntegration(lumi(), inputs('c1')) as unknown as {
      contents: Record<string, { contentUrl: string }>;
      editor: { filesPath: string; ajaxPath: string };
      crossorigin?: string;
    };
    // Assert
    const onFiles = (url: string | undefined) =>
      url?.startsWith(`${FILES}/`) ? url.slice(FILES.length) : '';
    const [, fileGrant, content] =
      /^\/h5p\/editor-files\/([^/]+)\/(.+)$/.exec(onFiles(result.contents['cid-c1']?.contentUrl)) ?? [];
    expect(Object.keys(result.contents)).toEqual(['cid-c1']);
    expect(content).toBe('c1');
    expect(editorFiles.verifyGrant(fileGrant ?? '', 'c1', NOW).valid).toBe(true);
    // SECURITY: the player's path accepts only the player's grants, so an editor's grant opens nothing there.
    expect(new ContentFileGrants(ring).verifyGrant(fileGrant ?? '', 'c1', NOW).valid).toBe(false);
    const [, grant, owner] = /^\/h5p\/uploads\/([^/]+)\/(.+)$/.exec(onFiles(result.editor.filesPath)) ?? [];
    expect(owner).toBe('acc%201');
    expect(uploads.verifyGrant(grant ?? '', 'acc 1', NOW).valid).toBe(true);
    expect(result.editor.ajaxPath).toBe('/h5p/ajax?action=');
    // WHY: the picture tool exports a canvas, which a browser refuses for a cross-origin picture loaded without CORS.
    expect(result.crossorigin).toBe('anonymous');
  });

  it('[SEC-004] a test bed without a files origin gets the same paths, relative', () => {
    // Act
    const result = editorIntegration(lumi(), { ...inputs('c1'), filesOrigin: '' }) as unknown as {
      contents: Record<string, { contentUrl: string }>;
      editor: { filesPath: string };
    };
    // Assert
    expect(result.contents['cid-c1']?.contentUrl).toMatch(/^\/h5p\/editor-files\/[^/]+\/c1$/);
    expect(result.editor.filesPath).toMatch(/^\/h5p\/uploads\/[^/]+\/acc%201$/);
  });

  it('[H5P-007] a new activity gets no content grant, and Lumi’s object is not changed', () => {
    const original = lumi();
    const result = editorIntegration(original, inputs(undefined));
    expect((result as unknown as { contents: object }).contents).toEqual({});
    expect(original.editor?.filesPath).toBe('/h5p/temp-files');
    expect(original.user.name).toBe('Kari');
  });
});
