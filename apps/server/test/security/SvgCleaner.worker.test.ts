/**
 * Tests for the SVG cleaner with its real worker thread: the time limit and the memory limit stop a cleaning that
 * the main thread could not have stopped, the main thread goes on meanwhile, nothing is left in the temporary
 * folder, an ordinary file comes out exactly as the steps give it, and the worker starts in a process that is
 * started the way the server is.
 *
 * Spec: SEC-001
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { RejectedUploadError } from '../../src/security/RejectedUploadError.js';
import {
  SvgCleaner,
  SVG_CLEANING_LIMITS,
  SVG_COPY_FOLDER_PREFIX,
} from '../../src/security/svg/SvgCleaner.js';
import { cleanSvgText } from '../../src/security/svg/svgPipeline.js';
import { sanitizeSvgText, warmUpSvgCleaning } from '../../src/security/SvgSanitizer.js';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const ORDINARY = `<svg ${NS} onload="x()"><script>x()</script><rect width="1" height="1"/></svg>`;
/** Nesting this deep takes the steps far longer than any limit used here. */
const SLOW = `<svg ${NS}>${'<g>'.repeat(16_000)}${'</g>'.repeat(16_000)}</svg>`;
/** This many elements need several times the memory of the small limit used here, so the limit decides. */
const LARGE = `<svg ${NS}>${'<g/>'.repeat(600_000)}</svg>`;

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const SANITIZER = new URL('../../src/security/SvgSanitizer.ts', import.meta.url).href;
const CLEANER = new URL('../../src/security/svg/SvgCleaner.ts', import.meta.url).href;
const LOADER = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
/** Runs a script in a new Node process started with the TypeScript loader, and returns what it printed. */
const inNewProcess = async (script: string, loader = 'tsx', cwd = SERVER_DIR, flags: string[] = []) => {
  const args = [...flags, '--import', loader, '--input-type=module', '-e', script];
  return (await promisify(execFile)(process.execPath, args, { cwd, timeout: 60_000 })).stdout;
};
/** Cleans one file with the server's own cleaner in a new Node process, and returns what it printed. */
const cleanedInNewProcess = (loader: string, cwd: string): Promise<string> =>
  inNewProcess(
    `const { sanitizeSvgText } = await import(${JSON.stringify(SANITIZER)});
    process.stdout.write(await sanitizeSvgText(${JSON.stringify(ORDINARY)}));`,
    loader,
    cwd,
  );

const keyOf = async (cleaning: Promise<string>): Promise<string> => {
  const error = await cleaning.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  return error instanceof RejectedUploadError ? error.messageKey : `not a refusal: ${String(error)}`;
};

describe('[SEC-001] the SVG cleaner with its worker thread', () => {
  const previous = process.env.TMPDIR;
  let dir: string;
  let cleaner: SvgCleaner | undefined;
  /** The cleaner's own folders in the temporary folder (the TypeScript loader keeps a cache there too). */
  const copyFolders = () => readdirSync(dir).filter((name) => name.startsWith(SVG_COPY_FOLDER_PREFIX));
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'svg-cleaner-'));
    process.env.TMPDIR = dir;
  });
  afterEach(async () => {
    await cleaner?.close();
    cleaner = undefined;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    rmSync(dir, { recursive: true, force: true });
  });

  it('[SEC-001] a file that takes too long is refused while the main thread goes on, and the next file is cleaned', async () => {
    // Arrange: a short time limit, and a clock on the main thread that notes its longest pause
    cleaner = new SvgCleaner({ ...SVG_CLEANING_LIMITS, timeMs: 400 });
    let longestPause = 0;
    let last = performance.now();
    const clock = setInterval(() => {
      longestPause = Math.max(longestPause, performance.now() - last);
      last = performance.now();
    }, 10);
    // Act
    const refused = await keyOf(cleaner.clean(SLOW));
    clearInterval(clock);
    const next = await cleaner.clean(ORDINARY);
    // Assert
    expect(refused).toBe('upload.file.svgTooComplex');
    expect(longestPause).toBeLessThan(250);
    expect(next).toContain('<rect');
    expect(next).not.toMatch(/script|onload/);
    expect(copyFolders()).toEqual([]);
  });

  it('[SEC-001] a file that needs more memory than the limit is refused, and the next file is cleaned', async () => {
    // Arrange: a small memory limit and a time limit that would not stop the file
    cleaner = new SvgCleaner({ ...SVG_CLEANING_LIMITS, memoryMb: 64, timeMs: 60_000 });
    // Act
    const refused = await keyOf(cleaner.clean(LARGE));
    const next = await cleaner.clean(ORDINARY);
    // Assert
    expect(refused).toBe('upload.file.svgTooComplex');
    expect(next).toContain('<rect');
    expect(copyFolders()).toEqual([]);
  });

  it('[SEC-001] the memory limit holds in a process started with a heap flag, which switches the runtime’s own limit off', async () => {
    // Arrange: a process with `--max-old-space-size`, a 64 MB limit for the worker and a time limit far away
    const script = `const { SvgCleaner } = await import(${JSON.stringify(CLEANER)});
      const cleaner = new SvgCleaner({ timeMs: 50000, memoryMb: 64, waitMs: 50000, startMs: 50000 });
      const large = '<svg ${NS}>' + '<g/>'.repeat(600000) + '</svg>';
      const outcome = await cleaner.clean(large).then(() => 'cleaned', (error) => error.messageKey ?? 'error');
      process.stdout.write(outcome + ' ' + Math.round(process.memoryUsage().rss / 1048576));
      await cleaner.close();`;
    // Act
    const [outcome, rssMb] = (
      await inNewProcess(script, 'tsx', SERVER_DIR, ['--max-old-space-size=4096'])
    ).split(' ');
    // Assert
    expect(outcome).toBe('upload.file.svgTooComplex');
    expect(Number(rssMb)).toBeLessThan(1024);
  });

  it('[SEC-001] an ordinary file comes out as the steps give it, and an unsafe one is refused as before', async () => {
    // Arrange
    cleaner = new SvgCleaner();
    const copyDir = mkdtempSync(join(dir, 'in-thread-'));
    // Act
    const [inWorker, inThread] = [await cleaner.clean(ORDINARY), await cleanSvgText(ORDINARY, copyDir)];
    const unsafe = await keyOf(cleaner.clean(`<!DOCTYPE svg [<!ENTITY a "b">]><svg ${NS}/>`));
    rmSync(copyDir, { recursive: true, force: true });
    // Assert
    expect(inWorker).toBe(inThread);
    expect(unsafe).toBe('upload.file.svgRejected');
    expect(copyFolders()).toEqual([]);
    expect(SVG_CLEANING_LIMITS).toEqual({ timeMs: 5_000, memoryMb: 512, waitMs: 20_000, startMs: 30_000 });
  });

  it('[SEC-001] the warm-up at server start starts the worker and reports nothing when it works', async () => {
    const failures: unknown[] = [];
    warmUpSvgCleaning((error) => failures.push(error));
    expect(await sanitizeSvgText(ORDINARY)).toContain('<rect');
    expect(failures).toEqual([]);
  });

  it('[SEC-001] the worker starts in a process started as the server is, from any working directory, and lets it end', async () => {
    // Act: `node --import tsx` in the server's folder, as in the Docker image, and from another folder
    const asServer = await cleanedInNewProcess('tsx', SERVER_DIR);
    const elsewhere = await cleanedInNewProcess(LOADER, dir);
    // Assert: both printed the cleaned file and ended by themselves
    for (const printed of [asServer, elsewhere]) {
      expect(printed).toContain('<rect');
      expect(printed).not.toMatch(/script|onload/);
    }
  });
});
