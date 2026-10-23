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
 *   - Order (D-044): pre-check on the raw text → Lumi's sanitiser on a temporary copy named "*.svg" → our
 *     DOMPurify pass → final check. The file is overwritten only with text that passed the final check.
 *   - Anything that cannot be made safe is refused with `upload.file.svgRejected`; the file is then not changed.
 *   - The temporary copy is always removed.
 * Collaborators: ./svg/svgPrecheck.ts, ../h5p/lumiInternals.ts (LumiSvgSanitizer), ./svg/svgPurify.ts,
 *   ./svg/svgFinalCheck.ts; registered in `fileSanitizers` for editor uploads and package imports, after
 *   ./FileTypeSniffer.ts.
 * Tests: apps/server/test/security/SvgSanitizer.test.ts, apps/server/test/security/SvgSanitizer.bypass.test.ts,
 *   apps/server/test/security/SvgSanitizer.render.test.ts
 */
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSanitizerResult, type IFileSanitizer } from '@lumieducation/h5p-server';
import { LumiSvgSanitizer } from '../h5p/lumiInternals.js';
import { fileExtension } from './fileExtension.js';
import { RejectedUploadError } from './RejectedUploadError.js';
import { assertSafeSvg } from './svg/svgFinalCheck.js';
import { precheckSvg } from './svg/svgPrecheck.js';
import { purifySvg } from './svg/svgPurify.js';

/** Largest SVG accepted, in megabytes (D-044). */
export const SVG_MAX_MB = 5;
const SVG_MAX_BYTES = SVG_MAX_MB * 1024 * 1024;

/**
 * Runs Lumi's sanitiser on a temporary copy that ends in ".svg", so it cannot skip the text.
 * @param text - SVG text after the pre-check.
 * @returns Lumi's output.
 */
async function lumiSanitize(text: string): Promise<string> {
  // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-svg-sanitizer/src/SvgSanitizer.ts skips paths not ending in ".svg".
  const dir = await mkdtemp(join(tmpdir(), 'hvl-svg-'));
  try {
    const copy = join(dir, 'upload.svg');
    await writeFile(copy, text, 'utf8');
    const result = await new LumiSvgSanitizer().sanitize(copy);
    if (result !== FileSanitizerResult.Sanitized) throw new RejectedUploadError('upload.file.svgRejected');
    return await readFile(copy, 'utf8');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Sanitises SVG text through the whole D-044 pipeline.
 * @param raw - The uploaded SVG, decoded as UTF-8.
 * @returns Safe SVG text, starting with `<svg`.
 * @throws RejectedUploadError `upload.file.svgRejected` when the file cannot be made safe.
 */
export async function sanitizeSvgText(raw: string): Promise<string> {
  const prechecked = precheckSvg(raw);
  const purified = purifySvg(await lumiSanitize(prechecked));
  assertSafeSvg(purified);
  return purified;
}

/** HVL's SVG sanitiser for Lumi's `fileSanitizers` (SEC-001). */
export class SvgSanitizer implements IFileSanitizer {
  readonly name = 'HVL SVG sanitiser (SEC-001, D-044)';

  /**
   * Sanitises the file in place when it is an SVG.
   * @param file - Path of the uploaded file.
   * @returns Sanitized for SVG files, Ignored for every other extension.
   * @throws RejectedUploadError `upload.file.tooLarge` over 5 MB, `upload.file.svgRejected` when unsafe.
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
