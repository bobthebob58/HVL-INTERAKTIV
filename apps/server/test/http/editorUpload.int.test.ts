/**
 * Integration tests for editor file uploads: SVGs are neutralised, wrong bytes and disallowed types are refused
 * with the reason, oversize files get 413, and no upload folder is left behind.
 *
 * Spec: SEC-001, SEC-002, SEC-004, SEC-005, H5P-006
 */
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { MAX_FILE_SIZE } from '../../src/h5p/H5pConfigFactory.js';
import { t } from '../../src/i18n/translate.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import { PNG_1X1, rawBody, uploadEditorFile } from '../support/uploadFixtures.js';
import { requestAs } from '../support/requestAs.js';

const EVIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)"><script>alert(2)</script>' +
  '<a href="javascript:alert(3)"><rect width="10" height="10"/></a></svg>';
const uploadFolders = () => readdirSync(tmpdir()).filter((name) => name.startsWith('hvli-upload-')).length;

describeWithServices('H5P editor uploads', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
  }, 60_000);
  afterAll(() => tb.close());

  it('[SEC-001] an uploaded SVG is stored without script, event handlers or javascript: links', async () => {
    // Act
    const res = await uploadEditorFile(tb.app, author, 'Logo.SVG', Buffer.from(EVIL_SVG));
    // Assert: accepted, and served back sandboxed and without active content
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const { path } = res.body as { path: string };
    const file = await requestAs(tb.app, author, 'get', `/h5p/temp-files/${path.replace(/#tmp$/, '')}`)
      .buffer(true)
      .parse(rawBody);
    expect(file.status).toBe(200);
    expect(file.headers['content-security-policy']).toMatch(/^sandbox/);
    const stored = (file.body as Buffer).toString('utf8');
    expect(stored).toContain('<rect');
    expect(stored).not.toMatch(/<script|onload|javascript:/i);
  });

  it('[SEC-002] HTML saved as .png is refused with the reason, in the author’s language', async () => {
    // Act
    const res = await uploadEditorFile(
      tb.app,
      author,
      'bilde.png',
      Buffer.from('<html><script>alert(1)</script>'),
    );
    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      errorCode: 'upload.file.typeMismatch',
      message: t('upload.file.typeMismatch', { extension: 'png' }, 'nn'),
    });
  });

  it('[SEC-002] a file type outside the allowlist is refused', async () => {
    const res = await uploadEditorFile(tb.app, author, 'side.html', Buffer.from('<p>x</p>'), {
      name: 'f',
      type: 'file',
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'upload.file.notAllowed' });
  });

  it('[SEC-005] an upload over 50 MB is refused with 413 and never stored', async () => {
    const res = await uploadEditorFile(
      tb.app,
      author,
      'stor.png',
      Buffer.concat([PNG_1X1, Buffer.alloc(MAX_FILE_SIZE)]),
    );
    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ message: t('error.tooLarge', { maxMb: 50 }, 'nn') });
  });

  it('[SEC-002] a valid PNG is accepted and served as an inline image', async () => {
    const res = await uploadEditorFile(tb.app, author, 'bilde.png', PNG_1X1);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const { path, mime } = res.body as { path: string; mime: string };
    expect(mime).toBe('image/png');
    const file = await requestAs(tb.app, author, 'get', `/h5p/temp-files/${path.replace(/#tmp$/, '')}`);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['content-disposition'] ?? 'inline').toMatch(/^inline/);
  });

  it('[H5P-006] a learner cannot upload, and nobody but the uploader reads a temporary file', async () => {
    const learner = await tb.actor('learner');
    expect((await uploadEditorFile(tb.app, learner, 'a.png', PNG_1X1)).status).toBe(403);
    const { path } = (await uploadEditorFile(tb.app, author, 'b.png', PNG_1X1)).body as { path: string };
    const colleague = await tb.actor('author');
    const other = await requestAs(tb.app, colleague, 'get', `/h5p/temp-files/${path.replace(/#tmp$/, '')}`);
    expect(other.status).toBeGreaterThanOrEqual(400);
    expect(other.status).toBeLessThan(500);
  });

  it('[SEC-005] no upload folder is left behind, whether the upload is accepted or refused', async () => {
    const before = uploadFolders();
    await uploadEditorFile(tb.app, author, 'ok.png', PNG_1X1);
    await uploadEditorFile(tb.app, author, 'bad.png', Buffer.from('<html>'));
    expect(uploadFolders()).toBe(before);
  });
});
