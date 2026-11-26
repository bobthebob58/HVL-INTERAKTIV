/**
 * svgPipeline — the steps that make an uploaded SVG safe, in D-044's order.
 *
 * Why: the steps parse a text an author sent into documents, twice, and how long that takes depends on the text.
 *      So they never run on the server's main thread: ./SvgCleaner.ts runs them in a worker thread with a time and
 *      a memory limit (D-119). This module is the steps alone, with the messages the two threads exchange.
 * Spec: SEC-001
 * Invariants:
 *   - Order (D-044): pre-check on the raw text → Lumi's sanitiser on a copy named `upload.svg` in the folder the
 *     caller gives → our DOMPurify pass → final check. Only text that passed the final check is returned.
 *   - Anything that cannot be made safe is refused with `upload.file.svgRejected`.
 *   - Nothing is written but the one copy; the folder is the caller's, to make and to remove.
 * Collaborators: ./svgPrecheck.ts, ../../h5p/lumiInternals.ts (LumiSvgSanitizer), ./svgPurify.ts,
 *   ./svgFinalCheck.ts, ./svgCleaningWorker.ts (runs it), ./SvgCleaner.ts (owns the worker and the folder).
 * Tests: apps/server/test/security/SvgSanitizer.test.ts, apps/server/test/security/SvgSanitizer.bypass.test.ts,
 *   apps/server/test/security/SvgCleaner.worker.test.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileSanitizerResult } from '@lumieducation/h5p-server';
import { LumiSvgSanitizer } from '../../h5p/lumiInternals.js';
import { RejectedUploadError, type RejectedUploadKey } from '../RejectedUploadError.js';
import { assertSafeSvg } from './svgFinalCheck.js';
import { precheckSvg } from './svgPrecheck.js';
import { purifySvg } from './svgPurify.js';

/** What the main thread sends the worker: one SVG, and the folder for Lumi's temporary copy. */
export interface SvgCleaningRequest {
  /** The uploaded SVG, decoded as UTF-8. */
  readonly raw: string;
  /** An existing, empty folder that the sender removes afterwards. */
  readonly copyDir: string;
}

/** What the worker answers: the safe text, a refusal for the author, or an unexpected failure. */
export type SvgCleaningAnswer =
  | { readonly safe: string }
  | {
      readonly refused: { readonly key: RejectedUploadKey; readonly params: Record<string, string | number> };
    }
  | { readonly failed: string };

/** The worker's first message, sent once it has loaded the steps. */
export interface SvgWorkerReady {
  readonly ready: true;
}

/**
 * Runs Lumi's sanitiser on a temporary copy that ends in ".svg", so it cannot skip the text.
 * @param text - SVG text after the pre-check.
 * @param copyDir - The folder for the copy.
 * @returns Lumi's output.
 */
async function lumiSanitize(text: string, copyDir: string): Promise<string> {
  // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-svg-sanitizer/src/SvgSanitizer.ts skips paths not ending in ".svg".
  // Remove the copy when Lumi sanitises by content; test/security/upstream/lumiSvgSanitizer.test.ts then fails.
  const copy = join(copyDir, 'upload.svg');
  await writeFile(copy, text, 'utf8');
  const result = await new LumiSvgSanitizer().sanitize(copy);
  if (result !== FileSanitizerResult.Sanitized) throw new RejectedUploadError('upload.file.svgRejected');
  return readFile(copy, 'utf8');
}

/**
 * Sanitises SVG text through the whole D-044 pipeline, in the calling thread.
 * @param raw - The uploaded SVG, decoded as UTF-8.
 * @param copyDir - An existing folder for Lumi's temporary copy.
 * @returns Safe SVG text, starting with `<svg`.
 * @throws RejectedUploadError `upload.file.svgRejected` when the file cannot be made safe.
 */
export async function cleanSvgText(raw: string, copyDir: string): Promise<string> {
  const prechecked = precheckSvg(raw);
  const purified = purifySvg(await lumiSanitize(prechecked, copyDir));
  assertSafeSvg(purified);
  return purified;
}

/**
 * Runs the pipeline and puts its outcome in a message for the other thread.
 * @param request - The SVG and the folder for the copy.
 * @returns The answer; never rejects.
 */
export async function answerSvgCleaning(request: SvgCleaningRequest): Promise<SvgCleaningAnswer> {
  try {
    return { safe: await cleanSvgText(request.raw, request.copyDir) };
  } catch (error) {
    if (error instanceof RejectedUploadError) {
      return { refused: { key: error.messageKey, params: error.params } };
    }
    // SECURITY: the message of an unexpected error stays on the server; the route answers 500 without it.
    return { failed: error instanceof Error ? error.message : String(error) };
  }
}
