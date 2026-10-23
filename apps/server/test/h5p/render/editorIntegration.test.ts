/**
 * Tests for our editor integration: no user identity, a content grant for an existing activity only, an upload
 * grant bound to the owner, and Lumi's object left unchanged.
 *
 * Spec: H5P-007, DATA-002
 */
import type { IIntegration } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import { ContentFileGrants } from '../../../src/h5p/contentFileGrants.js';
import { editorIntegration } from '../../../src/h5p/render/editorIntegration.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { randomKey } from '../../support/authEnv.js';

const NOW = new Date('2026-10-23T10:00:00Z');
const uploads = new ContentFileGrants(parseKeyring(`k1=${randomKey(1)}`), 'temporary-file-url');
const lumi = (): IIntegration =>
  ({
    user: { name: 'Kari', mail: 'kari@hvl.no', id: 'acc-1' },
    editor: { filesPath: '/h5p/temp-files', ajaxPath: '/h5p/ajax?action=' },
  }) as unknown as IIntegration;
const inputs = (contentId: string | undefined) => ({
  contentId,
  ownerId: 'acc 1',
  contentUrl: (id: string) => `/h5p/files/GRANT/${id}`,
  uploadGrants: uploads,
  baseUrl: '/h5p',
  now: NOW,
});

describe('[H5P-007] editor integration', () => {
  it('[DATA-002] names nobody, whatever Lumi put in', () => {
    expect(editorIntegration(lumi(), inputs('c1')).user).toEqual({ name: '', mail: '', id: '' });
  });

  it('[H5P-007] gives an existing activity its signed content URL and the owner a signed upload path', () => {
    // Act
    const result = editorIntegration(lumi(), inputs('c1')) as unknown as {
      contents: Record<string, { contentUrl: string }>;
      editor: { filesPath: string; ajaxPath: string };
    };
    // Assert
    expect(result.contents).toEqual({ 'cid-c1': { contentUrl: '/h5p/files/GRANT/c1' } });
    const [, grant, owner] = /^\/h5p\/uploads\/([^/]+)\/(.+)$/.exec(result.editor.filesPath) ?? [];
    expect(owner).toBe('acc%201');
    expect(uploads.verifyGrant(grant ?? '', 'acc 1', NOW).valid).toBe(true);
    expect(result.editor.ajaxPath).toBe('/h5p/ajax?action=');
  });

  it('[H5P-007] a new activity gets no content grant, and Lumi’s object is not changed', () => {
    const original = lumi();
    const result = editorIntegration(original, inputs(undefined));
    expect((result as unknown as { contents: object }).contents).toEqual({});
    expect(original.editor?.filesPath).toBe('/h5p/temp-files');
    expect(original.user.name).toBe('Kari');
  });
});
