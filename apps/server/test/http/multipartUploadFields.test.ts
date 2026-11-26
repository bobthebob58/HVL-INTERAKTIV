/**
 * Tests of the text fields of an upload request (D-143): few and small, never cut short, and a request past the
 * limits is refused with 400 and leaves no folder. The editor's route is covered in ./uploadLimits.int.test.ts.
 *
 * Spec: SEC-005
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../../src/http/HttpError.js';
import {
  MAX_UPLOAD_FIELD_BYTES,
  MAX_UPLOAD_FIELD_NAME,
  MAX_UPLOAD_FIELDS,
  MAX_UPLOAD_PARTS,
  readMultipart,
} from '../../src/http/multipartUpload.js';
import { PNG_1X1 } from '../support/uploadFixtures.js';

interface Seen {
  fields?: Record<string, string>;
  fileName?: string;
  status?: number;
}

/** Sends one request to an app that reads an upload; answers what it saw and what stayed in the temp folder. */
async function sent(build: (test: request.Test) => request.Test): Promise<Seen & { left: string[] }> {
  const seen: Seen = {};
  const previous = process.env.TMPDIR;
  const dir = mkdtempSync(join(tmpdir(), 'multipart-fields-'));
  process.env.TMPDIR = dir;
  const app = express().post('/u', async (req, res) => {
    try {
      const body = await readMultipart(req, { fileField: 'file', maxFileSize: 1024 });
      Object.assign(seen, { fields: { ...body.fields }, fileName: body.file?.name });
      await body.cleanup();
      res.json({});
    } catch (error) {
      res.status(error instanceof HttpError ? error.status : 500).end();
    }
  });
  try {
    seen.status = (await build(request(app).post('/u'))).status;
    return { ...seen, left: readdirSync(dir) };
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
}

const withFields = (test: request.Test, count: number): request.Test =>
  Array.from({ length: count }).reduce<request.Test>((t, _, n) => t.field(`f${n}`, `${n}`), test);

describe('[SEC-005] the text fields of an upload request', () => {
  it('[SEC-005] the editor’s fields arrive whole, up to the limits', async () => {
    // Arrange
    const longest = `{"name":"${'å'.repeat((MAX_UPLOAD_FIELD_BYTES - 11) / 2)}"}`;
    // Act
    const upload = await sent((test) =>
      test.attach('file', PNG_1X1, 'bilde.png').field('field', longest).field('contentId', '0'),
    );
    const most = await sent((test) => withFields(test, MAX_UPLOAD_FIELDS));
    // Assert
    expect(Buffer.byteLength(longest)).toBe(MAX_UPLOAD_FIELD_BYTES - 1);
    expect(upload).toMatchObject({ status: 200, fields: { field: longest, contentId: '0' }, left: [] });
    expect(upload.fileName).toBe('bilde.png');
    expect(most).toMatchObject({ status: 200, fields: { f0: '0', f1: '1', f2: '2', f3: '3' } });
  });

  it('[SEC-005] one field more, a longer field or a longer name is 400, with or without a file', async () => {
    // Arrange
    const tooLong = 'x'.repeat(MAX_UPLOAD_FIELD_BYTES + 1);
    const longName = 'n'.repeat(MAX_UPLOAD_FIELD_NAME + 1);
    // Act
    const refused = [
      await sent((test) => withFields(test, MAX_UPLOAD_FIELDS + 1)),
      await sent((test) => withFields(test.attach('file', PNG_1X1, 'bilde.png'), MAX_UPLOAD_FIELDS + 1)),
      await sent((test) => test.field('field', tooLong)),
      await sent((test) => test.field('field', tooLong).attach('file', PNG_1X1, 'bilde.png')),
      await sent((test) =>
        test.attach('file', PNG_1X1, 'bilde.png').field('contentId', '0').field(longName, '1'),
      ),
    ];
    // Assert: refused as a whole, nothing cut short and passed on, no folder left
    expect(refused).toEqual(refused.map(() => ({ status: 400, left: [] })));
  });

  it('[SEC-005] a request holds a bounded number of parts; a second file within it is still discarded unread', async () => {
    // Arrange
    const files = (test: request.Test, count: number): request.Test =>
      Array.from({ length: count }).reduce<request.Test>(
        (t, _, n) => t.attach('file', PNG_1X1, `${n}.png`),
        test,
      );
    // Act
    const within = await sent((test) => files(withFields(test, 2), MAX_UPLOAD_PARTS - 2));
    const past = await sent((test) => files(withFields(test, 2), MAX_UPLOAD_PARTS - 1));
    // Assert
    expect(within).toMatchObject({ status: 200, fileName: '0.png', left: [] });
    expect(past).toEqual({ status: 400, left: [] });
  });
});
