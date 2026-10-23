/**
 * Tests for choosing a library's files from its repository checkout: what is copied, what is left out, and that
 * the allowed extensions never exceed what the server accepts in library folders.
 *
 * Spec: H5P-003, SEC-005
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ALLOWED_EXTENSIONS, copyLibraryFiles, isLibraryFile, libraryFileList } from '../libraryFiles.mjs';

const dirs = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tree = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'h5p-lib-'));
  dirs.push(dir);
  for (const rel of files) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), rel);
  }
  return dir;
};

describe('[H5P-003] library files from a checkout', () => {
  it('[H5P-003] keeps the library and its assets, and leaves out tooling, tests, docs and hidden files', () => {
    // Arrange
    const dir = tree([
      'library.json',
      'semantics.json',
      'language/nn.json',
      'js/main.js',
      'css/main.css',
      'fonts/icons.woff2',
      'images/icon.svg',
      'upgrades.js',
      'presave.js',
      'README.md',
      'package.json',
      'package-lock.json',
      'webpack.config.js',
      '.eslintrc.json',
      '.github/workflow.yml',
      'node_modules/x/index.js',
      'tests/a.js',
      'src/entry.js',
      'docs/notes.txt',
    ]);
    // Act
    const files = libraryFileList(dir, { built: false });
    // Assert
    expect(files).toEqual([
      'css/main.css',
      'docs/notes.txt',
      'fonts/icons.woff2',
      'images/icon.svg',
      'js/main.js',
      'language/nn.json',
      'library.json',
      'presave.js',
      'semantics.json',
      'src/entry.js',
      'upgrades.js',
    ]);
  });

  it('[H5P-003] a built library leaves out its top-level src folder, and copying reproduces the list', () => {
    const dir = tree(['library.json', 'dist/main.js', 'src/main.js', 'scripts/src/keep.js']);
    const dest = join(tree([]), 'out');
    expect(libraryFileList(dir, { built: true })).toEqual([
      'dist/main.js',
      'library.json',
      'scripts/src/keep.js',
    ]);
    expect(copyLibraryFiles(dir, dest, { built: true })).toEqual(libraryFileList(dest, { built: false }));
  });

  it('[H5P-003] recognises tooling configuration by name, whatever its extension', () => {
    for (const name of ['webpack.config.js', 'babel.config.cjs', 'postcss.config.mjs', 'jest.config.json']) {
      expect(isLibraryFile(name), name).toBe(false);
    }
    expect(isLibraryFile('h5p-drag-text.js')).toBe(true);
  });

  it('[SEC-005] every allowed extension is one the server accepts in a library folder', () => {
    // Arrange: the server's lists, read from its source so the two can never drift apart silently
    const source = readFileSync(
      new URL('../../../apps/server/src/h5p/H5pConfigFactory.ts', import.meta.url),
      'utf8',
    );
    const list = (name) => new RegExp(`${name} =\\s*'([^']+)'`).exec(source)?.[1].split(' ') ?? [];
    // Act
    const accepted = new Set([...list('CONTENT_WHITELIST'), ...list('LIBRARY_WHITELIST')]);
    // Assert
    expect(accepted.size).toBeGreaterThan(10);
    expect([...ALLOWED_EXTENSIONS].filter((e) => !accepted.has(e))).toEqual([]);
  });
});
