/**
 * SvgSanitizer — removes executable and externally loading content from SVG files that authors upload.
 *
 * Why: @lumieducation/h5p-server up to and including 10.0.4 is affected by CVE-2025-7062 (stored XSS through
 *      uploaded files) and no fixed release exists (D-003). Lumi's own SVG sanitiser only reads paths that end
 *      in a lower-case ".svg" and keeps external references, so HVL wraps it in a stricter pipeline (D-044).
 * Spec: SEC-001
 * Invariants:
 *   - Acts on every path whose lower-cased extension is "svg" (also ".SVG" and the dot-file ".svg"); every
 *     other path is Ignored and left untouched.
 *   - Files over 5 MB are refused before they are read (`upload.file.tooLarge`, maxMb 5).
 *   - Order (D-044, ./svg/svgPipeline.ts): pre-check on the raw text → Lumi's sanitiser on a temporary copy
 *     named "*.svg" → our DOMPurify pass → final check. The file is overwritten only with text that passed the
 *     final check.
 *   - The steps run in a worker thread, never on the main thread, within a time, a memory and a waiting limit
 *     (./svg/SvgCleaner.ts, D-119): past the first two the file is refused with `upload.file.svgTooComplex`, past
 *     the third with `upload.file.svgCheckBusy`.
 *   - Anything that cannot be made safe is refused with `upload.file.svgRejected`; a refused file is not changed.
 *   - The temporary copy is always removed.
 *   - The server starts the worker at its own start (`warmUpSvgCleaning`), so the first upload does not wait for it.
 * Collaborators: ./svg/SvgCleaner.ts (the worker and its limits), ./svg/svgPipeline.ts (the steps); registered in
 *   `fileSanitizers` for editor uploads and package imports, after ./FileTypeSniffer.ts; ../server/main.ts.
 * Tests: apps/server/test/security/SvgSanitizer.test.ts, apps/server/test/security/SvgSanitizer.bypass.test.ts,
 *   apps/server/test/security/SvgSanitizer.render.test.ts, apps/server/test/security/SvgCleaner.test.ts
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import { FileSanitizerResult, type IFileSanitizer } from '@lumieducation/h5p-server';
import { fileExtension } from './fileExtension.js';
import { RejectedUploadError } from './RejectedUploadError.js';
import { SvgCleaner } from './svg/SvgCleaner.js';

/** Largest SVG accepted, in megabytes (D-044). */
export const SVG_MAX_MB = 5;
const SVG_MAX_BYTES = SVG_MAX_MB * 1024 * 1024;

// WHY: one cleaner, so one worker thread, for the whole server; it starts with the first SVG (D-119).
const cleaner = new SvgCleaner();

/**
 * Sanitises SVG text through the whole D-044 pipeline, in the cleaner's worker thread.
 * @param raw - The uploaded SVG, decoded as UTF-8.
 * @returns Safe SVG text, starting with `<svg`.
 * @throws RejectedUploadError `upload.file.svgRejected` when the file cannot be made safe,
 *   `upload.file.svgTooComplex` when cleaning it takes too long or too much memory, `upload.file.svgCheckBusy`
 *   when it waited too long for its turn.
 */
export function sanitizeSvgText(raw: string): Promise<string> {
  return cleaner.clean(raw);
}

/**
 * Starts the cleaner's worker thread before the first upload needs it, by cleaning an empty drawing.
 * @param onFailure - Told why, when the worker could not start or clean. The server goes on; SVG uploads are then
 *   refused or fail, never stored unchecked.
 */
export function warmUpSvgCleaning(onFailure: (error: unknown) => void): void {
  void cleaner.clean('<svg xmlns="http://www.w3.org/2000/svg"/>').catch(onFailure);
}

/** HVL's SVG sanitiser for Lumi's `fileSanitizers` (SEC-001). */
export class SvgSanitizer implements IFileSanitizer {
  readonly name = 'HVL SVG sanitiser (SEC-001, D-044)';

  /**
   * Sanitises the file in place when it is an SVG.
   * @param file - Path of the uploaded file.
   * @returns Sanitized for SVG files, Ignored for every other extension.
   * @throws RejectedUploadError `upload.file.tooLarge` over 5 MB, `upload.file.svgRejected` when unsafe, and
   *   what `sanitizeSvgText` throws past the cleaner's limits.
   */
  async sanitize(file: string): Promise<FileSanitizerResult> {
    if (fileExtension(file) !== 'svg') return FileSanitizerResult.Ignored;
    if ((await stat(file)).size > SVG_MAX_BYTES) {
      throw new RejectedUploadError('upload.file.tooLarge', { maxMb: SVG_MAX_MB });
    }
    const safe = await sanitizeSvgText(await readFile(file, 'utf8'));
    await writeFile(file, safe, 'utf8');
    return FileSanitizerResult.Sanitized;
  }
}
