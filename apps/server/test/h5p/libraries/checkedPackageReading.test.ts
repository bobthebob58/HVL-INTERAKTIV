/**
 * Tests for unpacking a package with the reader of the archive check: Lumi's choice of entries is kept, the files
 * are the ones Lumi's own unpacking writes for an ordinary package, a damaged or mis-declared entry stops the
 * unpacking, the total limit holds, and the package file is always closed.
 *
 * Spec: SEC-005, SEC-003
 */
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  extractCheckedPackage,
  type PackageParts,
} from '../../../src/h5p/libraries/checkedPackageReading.js';
import { PackageImporter } from '../../../src/h5p/lumiInternals.js';
import { damageEntry, declareSize } from '../../support/damagedPackage.js';
import { buildH5pPackage, removeBuiltPackages } from '../../support/h5pPackageBuilder.js';
import { canListOpenFiles, openFilesUnder } from '../../support/openFiles.js';

const MC = { machineName: 'H5P.MultiChoice', minorVersion: 16, patchVersion: 5, runnable: true };
const ALL: PackageParts = { includeContent: true, includeLibraries: true, includeMetadata: true };
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';
const folders: string[] = [];

/** Every file under `dir`, as `relative path -> content`. */
function filesIn(dir: string, root = dir): Record<string, string> {
  const found: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(found, filesIn(path, root));
    else found[relative(root, path)] = readFileSync(path, 'utf8');
  }
  return found;
}

function target(): string {
  const dir = mkdtempSync(join(tmpdir(), 'checked-unpack-'));
  folders.push(dir);
  return dir;
}

const ordinary = () =>
  buildH5pPackage({
    main: MC,
    params: { question: 'Kva?', media: { path: 'images/a.svg', mime: 'image/svg+xml' } },
    files: { 'content/images/a.svg': SVG, 'content/.hidden': 'x', 'content/_private.txt': 'x' },
  });

afterAll(() => {
  removeBuiltPackages();
  folders.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('[SEC-005] unpacking a package with the reader that checked it', () => {
  it('[SEC-005] unpacks the parts that are asked for, and never a hidden file', async () => {
    // Arrange
    const pkg = await ordinary();
    const [content, libraries, metadata, nothing] = [target(), target(), target(), target()];
    // Act
    await extractCheckedPackage(pkg, content, { includeContent: true });
    await extractCheckedPackage(pkg, libraries, { includeLibraries: true });
    await extractCheckedPackage(pkg, metadata, { includeMetadata: true });
    await extractCheckedPackage(pkg, nothing);
    // Assert
    expect(Object.keys(filesIn(content)).sort()).toEqual(['content/content.json', 'content/images/a.svg']);
    expect(Object.keys(filesIn(libraries)).every((name) => name.startsWith('H5P.MultiChoice-1.16/'))).toBe(
      true,
    );
    expect(Object.keys(filesIn(libraries))).toContain('H5P.MultiChoice-1.16/library.json');
    expect(Object.keys(filesIn(metadata))).toEqual(['h5p.json']);
    expect(filesIn(nothing)).toEqual({});
  });

  it('[SEC-003] writes the files Lumi’s own unpacking writes for an ordinary package', async () => {
    // Arrange: Lumi's function as it is before any editor of this process replaces it
    const lumiExtract = PackageImporter.extractPackage.bind(PackageImporter);
    const pkg = await ordinary();
    const [ours, lumis] = [target(), target()];
    // Act
    await extractCheckedPackage(pkg, ours, ALL);
    await lumiExtract(pkg, lumis, ALL as Required<PackageParts>);
    // Assert
    expect(PackageImporter.extractPackage.toString()).toContain('yauzl_promise');
    expect(filesIn(ours)).toEqual(filesIn(lumis));
    expect(Object.keys(filesIn(ours)).length).toBeGreaterThan(4);
  });

  it('[SEC-005] an entry that cannot be read, or that declares another size than it has, stops the unpacking', async () => {
    // Arrange: a large file, damaged in one package and mis-declared in another
    const files = { 'content/images/large.bin': randomBytes(512 * 1024).toString('base64') };
    const damaged = await buildH5pPackage({ main: MC, files }, 'damaged.h5p');
    await damageEntry(damaged, 'content/images/large.bin');
    const misdeclared = await buildH5pPackage({ main: MC, files }, 'misdeclared.h5p');
    declareSize(misdeclared, 'content/images/large.bin', 1000);
    // Act
    const outcomes = await Promise.allSettled([
      extractCheckedPackage(damaged, target(), ALL),
      extractCheckedPackage(misdeclared, target(), ALL),
    ]);
    // Assert
    expect(outcomes).toMatchObject([
      { status: 'rejected', reason: { messageKey: 'upload.archive.unreadable' } },
      { status: 'rejected', reason: { messageKey: 'upload.archive.unreadable' } },
    ]);
    if (canListOpenFiles) expect(openFilesUnder('.h5p')).toEqual([]);
  });

  it('[SEC-005] never writes more bytes in all than the total limit', async () => {
    // Arrange
    const files = { 'content/a.txt': 'a'.repeat(600), 'content/b.txt': 'b'.repeat(600) };
    const pkg = await buildH5pPackage({ main: MC, files });
    const dir = target();
    // Act
    const unpacking = extractCheckedPackage(pkg, dir, { includeContent: true }, { maxTotalSize: 1000 });
    // Assert
    await expect(unpacking).rejects.toMatchObject({ messageKey: 'upload.archive.totalTooLarge' });
    const written = Object.values(filesIn(dir)).reduce((sum, text) => sum + text.length, 0);
    expect(written).toBeLessThanOrEqual(1000);
    if (canListOpenFiles) expect(openFilesUnder('.h5p')).toEqual([]);
  });
});
