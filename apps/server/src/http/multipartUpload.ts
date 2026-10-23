/**
 * multipartUpload — reads one uploaded file (and the text fields) of a multipart request into a fresh folder.
 *
 * Why: Lumi needs uploads as files on disk when sanitisers run, and its SVG sanitiser only reads paths that end
 *      in ".svg" (D-043). Lumi also has no size limit on editor uploads and trusts the browser's MIME type. Here
 *      the file keeps its lower-cased extension, its MIME type comes from that extension, and the size limit is
 *      enforced while the bytes arrive, so an oversize upload never fills the disk.
 * Spec: SEC-005, SEC-001, SEC-002
 * Invariants:
 *   - At most one file per request: the first file part, and only when it is in the expected field; every
 *     other file is discarded unread.
 *   - The file is written as `upload.<ext>` in a new `mkdtemp` folder; `cleanup()` removes the folder and must be
 *     called in a `finally` block by the route.
 *   - Over `maxFileSize` bytes: 413 `error.tooLarge`; malformed or non-multipart requests: 400.
 *   - No failure leaves a rejected promise unhandled (a truncated body would otherwise end the process).
 * Collaborators: ./routes/ajaxRoutes.ts, ../security/ContentFileHeaders.ts (MIME type by extension).
 * Tests: apps/server/test/http/multipartUpload.test.ts
 */
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Busboy } from '@fastify/busboy';
import type { Request } from 'express';
import { contentTypeFor } from '../security/ContentFileHeaders.js';
import { HttpError } from './HttpError.js';

/** An uploaded file, in the shape Lumi's editor expects. */
export interface UploadedFile {
  /** The file name the browser sent (used by Lumi for its extension checks). */
  readonly name: string;
  /** MIME type derived from the extension, never from the browser. */
  readonly mimetype: string;
  /** Bytes written. */
  readonly size: number;
  /** Path of the file on disk, ending in the lower-cased extension. */
  readonly tempFilePath: string;
}

/** What a multipart request carried. */
export interface MultipartBody {
  /** Text fields by name (the last value wins). */
  readonly fields: Readonly<Record<string, string>>;
  /** The uploaded file, if the expected field held one. */
  readonly file?: UploadedFile;
  /** Removes the temporary folder and everything in it. */
  cleanup(): Promise<void>;
}

/** Limits for one request. */
export interface MultipartOptions {
  /** Name of the form field that holds the file (`file` or `h5p`). */
  readonly fileField: string;
  /** Largest file in bytes. */
  readonly maxFileSize: number;
}

const MB = 1024 * 1024;

const safeExtension = (name: string): string => {
  const ext = extname(name).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '.bin';
};

/**
 * Reads a multipart/form-data request.
 * @param req - The request (not yet read by any body parser).
 * @param options - Field name and size limit.
 * @returns Fields, the file and a cleanup function.
 * @throws HttpError 400 for a request that is not multipart or is malformed, 413 for an oversize file.
 */
export async function readMultipart(req: Request, options: MultipartOptions): Promise<MultipartBody> {
  const contentType = req.headers['content-type'] ?? '';
  if (!/^multipart\/form-data/i.test(contentType)) throw new HttpError(400, 'error.badRequest');
  const dir = await mkdtemp(join(tmpdir(), 'hvli-upload-'));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  const fields: Record<string, string> = {};
  let file: UploadedFile | undefined;
  const writes: Promise<void>[] = [];
  try {
    const busboy = Busboy({
      headers: { ...req.headers, 'content-type': contentType },
      limits: { files: 1, fileSize: options.maxFileSize, fields: 20, fieldSize: 4 * MB, parts: 25 },
    });
    busboy.on('field', (name, value) => {
      fields[name] = value;
    });
    busboy.on('file', (fieldname, stream, filename) => {
      if (fieldname !== options.fileField || file) return void stream.resume();
      const ext = safeExtension(filename);
      const path = join(dir, `upload${ext}`);
      let tooLarge = false;
      stream.on('limit', () => {
        tooLarge = true;
      });
      const write = pipeline(stream, createWriteStream(path)).then(() => {
        if (tooLarge)
          throw new HttpError(413, 'error.tooLarge', { maxMb: Math.ceil(options.maxFileSize / MB) });
        file = {
          name: filename,
          mimetype: contentTypeFor(`x${ext}`).split(';')[0] ?? '',
          size: stream.bytesRead,
          tempFilePath: path,
        };
      });
      // SECURITY: when the request fails first (a truncated body), nobody awaits this write; without a handler
      // its rejection is unhandled and ends the Node process. The error is read through `writes` below.
      write.catch(() => undefined);
      writes.push(write);
    });
    await pipeline(req, busboy);
    await Promise.all(writes);
  } catch (error) {
    await Promise.allSettled(writes);
    await cleanup();
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'error.badRequest');
  }
  return { fields, ...(file ? { file } : {}), cleanup };
}
