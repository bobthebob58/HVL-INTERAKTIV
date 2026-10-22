/**
 * Pins upstream behaviour of Lumi's SVG sanitiser: it only reads paths that end in ".svg" (D-043).
 *
 * Spec: SEC-001
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSanitizerResult } from '@lumieducation/h5p-server';
import { LumiSvgSanitizer } from '../../../src/h5p/lumiInternals.js';

const dir = mkdtempSync(join(tmpdir(), 'lumi-svg-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const SCRIPTED =
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>';

describe('[SEC-001] upstream: Lumi SVG sanitiser', () => {
  it('[SEC-001] ignores a file whose path does not end in a lower-case .svg', async () => {
    // UPSTREAM: SvgSanitizer.js checks file.endsWith('.svg'); upload temp files without an extension and
    // "IMAGE.SVG" are skipped silently. Our uploads keep a lower-cased extension (D-043).
    for (const name of ['upload-tmp-1234', 'IMAGE.SVG']) {
      const file = join(dir, name);
      writeFileSync(file, SCRIPTED);
      expect(await new LumiSvgSanitizer().sanitize(file)).toBe(FileSanitizerResult.Ignored);
      expect(readFileSync(file, 'utf8')).toContain('<script>');
    }
  });

  it('[SEC-001] removes a script from a file that ends in .svg', async () => {
    const file = join(dir, 'image.svg');
    writeFileSync(file, SCRIPTED);
    expect(await new LumiSvgSanitizer().sanitize(file)).toBe(FileSanitizerResult.Sanitized);
    expect(readFileSync(file, 'utf8')).not.toContain('script');
  });
});
