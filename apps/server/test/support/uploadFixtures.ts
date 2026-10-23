/**
 * uploadFixtures — small valid files and an editor-upload helper for the HTTP upload tests.
 *
 * Why: the upload checks sniff real bytes (SEC-002), so tests need genuine PNG and PDF bytes, and they send
 *      files the way the H5P editor does: `POST ajax?action=files` with `file`, `field` (JSON) and `contentId`.
 * Spec: SEC-001, SEC-002, SEC-004
 * Tests: shared by apps/server/test/http/editorUpload.int.test.ts and apps/server/test/http/contentFiles.int.test.ts.
 */
import request from 'supertest';
import type { Express } from 'express';
import type { TestActor } from './httpTestbed.js';

/** The two-argument form of supertest's `.parse()` callback. */
type BodyParser = Extract<Parameters<request.Test['parse']>[0], (res: never, done: never) => void>;

/** A 1×1 transparent PNG. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** A minimal one-page PDF. */
export const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

/** The semantics field the editor sends with an image upload. */
export const IMAGE_FIELD = { name: 'media', type: 'image' };

/** The semantics field the editor sends with a generic file upload. */
export const FILE_FIELD = { name: 'file', type: 'file' };

/**
 * A supertest parser that keeps any response body as raw bytes (for images, SVGs, PDFs and packages).
 * @param res - The incoming response stream.
 * @param done - Callback with the collected bytes.
 */
export const rawBody: BodyParser = (res, done) => {
  // WHY: superagent types the response as its own Response; at run time it is Node's IncomingMessage.
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => done(null, Buffer.concat(chunks)));
};

/**
 * Uploads a file as the H5P editor does.
 * @param app - The Express app.
 * @param who - The uploading actor.
 * @param name - File name as the browser sends it.
 * @param bytes - File content.
 * @param field - Semantics field of the upload.
 * @returns The supertest response.
 */
export const uploadEditorFile = (
  app: Express,
  who: TestActor,
  name: string,
  bytes: Buffer,
  field: object = IMAGE_FIELD,
): request.Test =>
  request(app)
    .post('/h5p/ajax?action=files')
    .set(...who.header)
    .field('field', JSON.stringify(field))
    .field('contentId', '0')
    .attach('file', bytes, name);
