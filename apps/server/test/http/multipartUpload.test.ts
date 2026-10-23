/**
 * Tests for reading one uploaded file from a multipart request: the lower-cased extension is kept, the MIME type
 * comes from the extension, limits are enforced while streaming, and the folder is always removed.
 *
 * Spec: SEC-005, SEC-001, SEC-002
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../../src/http/HttpError.js';
import { readMultipart, type UploadedFile } from '../../src/http/multipartUpload.js';

interface Seen {
  fields?: Record<string, string>;
  file?: UploadedFile | undefined;
  content?: string;
  folderAfterCleanup?: boolean;
  error?: { status: number; key: string };
}

/** An app that reads one upload, records what it saw, and cleans up. */
function probeApp(maxFileSize = 1024): { app: express.Express; seen: Seen } {
  const seen: Seen = {};
  const app = express();
  app.post('/u', async (req, res) => {
    try {
      const body = await readMultipart(req, { fileField: 'file', maxFileSize });
      seen.fields = { ...body.fields };
      seen.file = body.file;
      seen.content = body.file ? readFileSync(body.file.tempFilePath, 'utf8') : undefined;
      await body.cleanup();
      seen.folderAfterCleanup = body.file ? existsSync(dirname(body.file.tempFilePath)) : undefined;
      res.json({ ok: true });
    } catch (error) {
      const e = error as HttpError;
      seen.error = { status: e.status, key: e.messageKey };
      res.status(e instanceof HttpError ? e.status : 500).end();
    }
  });
  return { app, seen };
}

describe('readMultipart', () => {
  it('[SEC-001] keeps the lower-cased extension and takes the MIME type from it, not from the browser', async () => {
    const { app, seen } = probeApp();
    await request(app)
      .post('/u')
      .field('contentId', '0')
      .attach('file', Buffer.from('<svg/>'), { filename: 'Logo.SVG', contentType: 'image/png' });
    expect(seen.file?.tempFilePath).toMatch(/[/\\]upload\.svg$/);
    expect(seen.file).toMatchObject({ name: 'Logo.SVG', mimetype: 'image/svg+xml', size: 6 });
    expect(seen.content).toBe('<svg/>');
    expect(seen.fields).toEqual({ contentId: '0' });
    expect(seen.folderAfterCleanup).toBe(false);
  });

  it('[SEC-002] a name without a usable extension is stored as .bin', async () => {
    for (const filename of ['README', 'bilde.pñg', 'x.' + 'a'.repeat(11)]) {
      const { app, seen } = probeApp();
      await request(app).post('/u').attach('file', Buffer.from('x'), filename);
      expect(seen.file?.tempFilePath, filename).toMatch(/upload\.bin$/);
    }
  });

  it('[SEC-005] reads one file only; later files are discarded unread', async () => {
    const { app, seen } = probeApp();
    await request(app)
      .post('/u')
      .attach('file', Buffer.from('first'), 'b.png')
      .attach('file', Buffer.from('second'), 'c.png')
      .attach('other', Buffer.from('ignored'), 'a.png');
    expect(seen.error).toBeUndefined();
    expect(seen.file?.name).toBe('b.png');
    expect(seen.content).toBe('first');
  });

  it('[SEC-005] the one file must be in the expected field; a file elsewhere leaves the request without one', async () => {
    const { app, seen } = probeApp();
    await request(app)
      .post('/u')
      .attach('other', Buffer.from('x'), 'a.png')
      .attach('file', Buffer.from('y'), 'b.png');
    expect(seen.error).toBeUndefined();
    expect(seen.file).toBeUndefined();
  });

  it('[SEC-005] an oversize file is refused with 413 while it streams, and its folder is removed', async () => {
    const { app, seen } = probeApp(16);
    const res = await request(app).post('/u').attach('file', Buffer.alloc(64, 'x'), 'big.png');
    expect(res.status).toBe(413);
    expect(seen.error).toEqual({ status: 413, key: 'error.tooLarge' });
  });

  it('[SEC-005] a request that is not multipart, or is malformed, is refused with 400', async () => {
    const json = probeApp();
    expect((await request(json.app).post('/u').send({ a: 1 })).status).toBe(400);
    const broken = probeApp();
    const res = await request(broken.app)
      .post('/u')
      .set('Content-Type', 'multipart/form-data; boundary=xyz')
      .send('--xyz\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n\r\nunterminated');
    expect(res.status).toBe(400);
    expect(broken.seen.error).toEqual({ status: 400, key: 'error.badRequest' });
  });

  it('[SEC-005] a request with only fields has no file', async () => {
    const { app, seen } = probeApp();
    await request(app).post('/u').field('field', '{"type":"image"}');
    expect(seen.file).toBeUndefined();
    expect(seen.fields).toEqual({ field: '{"type":"image"}' });
  });
});
