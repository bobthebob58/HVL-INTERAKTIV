/**
 * bundleFixtures — small synthetic H5P packages and fetch folders for the content-type bundle tests.
 *
 * Why: each test breaks one rule of the bundle (a hash, the ten types, a baked-in secret), and building the packages
 *      in code keeps the good and the broken example visible in the test itself (NFR-007).
 * Spec: NFR-007
 * Invariants:
 *   - Every folder lives under the OS temporary directory and is removed by `removeTempDirs()`.
 *   - A fetch folder holds the ten types' packages, each with a harmless script, and their `SHA256SUMS`.
 * Collaborators: ../contentTypeBundle.mjs (`BUNDLE_PACKAGES`, `BundleError`), yazl.
 * Tests: this helper is exercised by contentTypeBundle.test.mjs and bundleSecretGuard.test.mjs.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { ZipFile } from 'yazl';
import { BUNDLE_PACKAGES, BundleError } from '../contentTypeBundle.mjs';

const dirs = [];

/** Removes every folder `temp()` made. */
export const removeTempDirs = () =>
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));

/** A new empty folder under the OS temporary directory. */
export const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'h5p-bundle-'));
  dirs.push(dir);
  return dir;
};

/** The SHA-256 of a file, in hex. */
export const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** Writes a small `.h5p` (a zip) with the given entries. */
export const writePackage = (file, entries) =>
  new Promise((resolve, reject) => {
    const zip = new ZipFile();
    for (const [name, text] of Object.entries(entries))
      zip.addBuffer(Buffer.from(text), name, { mtime: new Date(0) });
    zip.end();
    const chunks = [];
    zip.outputStream.on('data', (chunk) => chunks.push(chunk));
    zip.outputStream.on('error', reject);
    zip.outputStream.on('end', () => resolve(writeFileSync(file, Buffer.concat(chunks))));
  });

/** A fetch's `packages/` folder: the ten types, each with a harmless script, and their `SHA256SUMS`. */
export async function fetchedPackages({ extra = {} } = {}) {
  const dir = temp();
  for (const name of BUNDLE_PACKAGES)
    await writePackage(join(dir, name), {
      'h5p.json': JSON.stringify({ mainLibrary: name.replace(/\.h5p$/, '') }),
      'H5P.Example-1.0/dist/example.js': 'var labels={OK:"Riktig",PATH:"/usr/bin"};',
      ...(extra[name] ?? {}),
    });
  writeFileSync(join(dir, 'SHA256SUMS'), BUNDLE_PACKAGES.map((n) => `${sha(join(dir, n))}  ${n}\n`).join(''));
  return dir;
}

/** Awaits a refusal and returns its problems; fails the test when the promise resolves or throws anything else. */
export const refusal = async (promise) => {
  const error = await promise.then(
    () => undefined,
    (e) => e,
  );
  expect(error).toBeInstanceOf(BundleError);
  return error.problems;
};
