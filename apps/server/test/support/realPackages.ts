/**
 * realPackages — the real H5P content types built from GitHub by `npm run h5p:fetch-libraries` (D-078): where their
 * packages are, a describe that needs them, and each package's example activity.
 *
 * Why: the theme, feedback and accessibility checks of S4 must run on real H5P markup (UD-003, UD-011, UD-030) and
 *      R-01 needs Core 1.28 with real libraries (D-047). The packages are fetched, not committed, so tests that
 *      need them skip on a developer machine without them and fail in CI, like the browser tests.
 * Spec: H5P-001, H5P-002, H5P-003
 * Invariants:
 *   - `REAL_H5P_PACKAGES_DIR` overrides the default `apps/server/var/h5p-real/packages`.
 *   - In CI a missing package folder is an error, never a silent skip.
 * Collaborators: ../../../../tools/h5p-libraries/fetchLibraries.mjs, ./httpTestbed.ts.
 * Tests: apps/server/test/h5p/realTypes.browser.int.test.ts
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe } from 'vitest';
import { fromBuffer, type Entry, type ZipFile } from 'yauzl';

/** Where the packages are. */
export const REAL_PACKAGES_DIR = resolve(
  process.env.REAL_H5P_PACKAGES_DIR ?? fileURLToPath(new URL('../../var/h5p-real/packages', import.meta.url)),
);

/** Whether the packages are present. */
export const hasRealPackages = (): boolean => existsSync(join(REAL_PACKAGES_DIR, 'SHA256SUMS'));

/**
 * A describe block that needs the real packages: skipped without them locally, failing without them in CI.
 * @param name - Block title.
 * @param body - The tests.
 */
export function describeWithRealPackages(name: string, body: () => void): void {
  if (hasRealPackages()) describe(name, body);
  else if (process.env.CI) {
    throw new Error(`${REAL_PACKAGES_DIR} is missing; run npm run h5p:fetch-libraries before the tests`);
  } else describe.skip(`${name} (no real H5P packages; run npm run h5p:fetch-libraries)`, body);
}

/** The example activity a package carries. */
export interface PackageExample {
  /** The package file name, e.g. `H5P.MultiChoice.h5p`. */
  readonly file: string;
  /** The main library as `H5P.Name major.minor`. */
  readonly library: string;
  /** `content/content.json`. */
  readonly params: object;
  /** Title, language and licence from `h5p.json`. */
  readonly metadata: { title: string; license: string; defaultLanguage?: string };
}

const readEntries = (buffer: Buffer, wanted: Set<string>): Promise<Map<string, Buffer>> =>
  new Promise((resolvePromise, reject) => {
    fromBuffer(buffer, { lazyEntries: true }, (error, zip?: ZipFile) => {
      if (error || !zip) return reject(error ?? new Error('not a zip'));
      const found = new Map<string, Buffer>();
      zip.on('entry', (entry: Entry) => {
        if (!wanted.has(entry.fileName)) return zip.readEntry();
        zip.openReadStream(entry, (err, stream) => {
          if (err || !stream) return reject(err ?? new Error('unreadable entry'));
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            found.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => resolvePromise(found));
      zip.readEntry();
    });
  });

/**
 * Reads every package's example activity.
 * @returns One example per package, sorted by file name.
 */
export async function packageExamples(): Promise<PackageExample[]> {
  const files = readdirSync(REAL_PACKAGES_DIR)
    .filter((f) => f.endsWith('.h5p'))
    .sort();
  return Promise.all(
    files.map(async (file) => {
      const wanted = new Set(['h5p.json', 'content/content.json']);
      const entries = await readEntries(readFileSync(join(REAL_PACKAGES_DIR, file)), wanted);
      const h5p = JSON.parse(String(entries.get('h5p.json'))) as {
        title: string;
        license: string;
        defaultLanguage?: string;
        mainLibrary: string;
        preloadedDependencies: { machineName: string; majorVersion: number; minorVersion: number }[];
      };
      const main = h5p.preloadedDependencies.find((d) => d.machineName === h5p.mainLibrary);
      if (!main) throw new Error(`${file}: h5p.json does not list its main library`);
      return {
        file,
        library: `${main.machineName} ${main.majorVersion}.${main.minorVersion}`,
        params: JSON.parse(String(entries.get('content/content.json'))) as object,
        metadata: { title: h5p.title, license: h5p.license, defaultLanguage: h5p.defaultLanguage },
      };
    }),
  );
}
