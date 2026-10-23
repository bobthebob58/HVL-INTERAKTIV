/**
 * sendUserFile — streams a content or temporary file with HVL's security headers and byte ranges.
 *
 * Why: files authors upload are untrusted. Every one is served with `nosniff` and a sandbox CSP, and anything
 *      but images, audio, video and captions as a download (`SEC-004`, D-045). Videos need byte ranges for
 *      seeking, and the Content-Type of a partial answer must still be the file's type (Lumi's Express router
 *      sent the file name there).
 * Spec: SEC-004, H5P-004
 * Invariants:
 *   - Headers come from ../security/ContentFileHeaders.ts, never from the stored object or the browser.
 *   - A single satisfiable range gives 206 with Content-Range; anything else sends the whole file with 200.
 *   - A stream error after the headers ends the connection (./h5pErrorHandler.ts); the source is always closed.
 * SPEC-DEVIATION: D-045 — files are served from the app's own origin until S3/S6 add the separate files origin.
 * Collaborators: ./routes/fileRoutes.ts, Lumi's H5PAjaxEndpoint (getContentFile, getTemporaryFile).
 * Tests: apps/server/test/http/contentFiles.int.test.ts
 */
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { contentFileHeaders } from '../security/ContentFileHeaders.js';

/** A file as Lumi's AJAX endpoint returns it. */
export interface UserFile {
  readonly stream: Readable;
  readonly stats: { readonly size: number };
  readonly range?: { readonly start: number; readonly end: number } | undefined;
}

/**
 * The range callback Lumi asks for: one satisfiable byte range of the request, or the whole file.
 * @param req - The request (its Range header).
 * @returns A function from file size to an inclusive range, or undefined for the whole file.
 */
export const requestedRange =
  (req: Request) =>
  (size: number): { start: number; end: number } | undefined => {
    if (!req.headers.range) return undefined;
    const ranges = req.range(size);
    if (!Array.isArray(ranges) || ranges.type !== 'bytes' || ranges.length !== 1 || !ranges[0])
      return undefined;
    return { start: ranges[0].start, end: ranges[0].end };
  };

/**
 * Sends a user file.
 * @param res - The response.
 * @param file - Stream, size and the range that was read.
 * @param filename - The file's name inside the content (decides the headers).
 */
export async function sendUserFile(res: Response, file: UserFile, filename: string): Promise<void> {
  res.set(contentFileHeaders(filename));
  res.set('Accept-Ranges', 'bytes');
  if (file.range) {
    res.status(206);
    res.set('Content-Range', `bytes ${file.range.start}-${file.range.end}/${file.stats.size}`);
    res.set('Content-Length', String(file.range.end - file.range.start + 1));
  } else {
    res.status(200);
    res.set('Content-Length', String(file.stats.size));
  }
  await pipeline(file.stream, res);
}
