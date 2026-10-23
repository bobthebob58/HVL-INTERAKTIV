/**
 * Tests for verifying fetched H5P client files against the committed hash lists.
 *
 * Spec: H5P-001
 */
import { describe, it, expect, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareTrees, hashTree, readHashList } from '../verifyClientFiles.mjs';

const dirs = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const sha = (text) => createHash('sha256').update(text).digest('hex');

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'h5p-files-'));
  dirs.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}

const LIST = `${sha('core')}  h5p-php-library-1.28.0/js/h5p.js\n${sha('php')}  h5p-php-library-1.28.0/h5p.classes.php\n`;

describe('[H5P-001] pinned H5P client files', () => {
  it('[H5P-001] parses sha256sum lists and strips the archive folder prefix', () => {
    expect([...readHashList(LIST, 'h5p-php-library-1.28.0/').keys()]).toEqual([
      'js/h5p.js',
      'h5p.classes.php',
    ]);
    expect(() => readHashList('not a hash line')).toThrow('not a sha256sum line');
  });

  it('[H5P-001] accepts a tree identical to the list', () => {
    const dir = tree({ 'js/h5p.js': 'core', 'h5p.classes.php': 'php' });
    expect(compareTrees(hashTree(dir), readHashList(LIST, 'h5p-php-library-1.28.0/'))).toEqual([]);
  });

  it('[H5P-001] reports changed, missing and unexpected files', () => {
    const dir = tree({ 'js/h5p.js': 'core, but tampered', 'js/extra.js': 'injected' });
    expect(compareTrees(hashTree(dir), readHashList(LIST, 'h5p-php-library-1.28.0/'))).toEqual([
      'changed: js/h5p.js',
      'missing: h5p.classes.php',
      'unexpected: js/extra.js',
    ]);
  });

  it('[H5P-001] the committed lists cover core 1.28.0 (67 files) and the pinned editor commit', () => {
    // Arrange
    const ref = fileURLToPath(
      new URL('../../../docs/reference/h5p-core-1.28-seed-packages/', import.meta.url),
    );
    // Act: parse both committed lists
    const core = readHashList(
      readFileSync(join(ref, 'h5p-php-library-1.28.0.files.sha256'), 'utf8'),
      'h5p-php-library-1.28.0/',
    );
    const editor = readHashList(
      readFileSync(join(ref, 'h5p-editor-php-library-ab2daa18.files.sha256'), 'utf8'),
      'h5p-editor-php-library-ab2daa18/',
    );
    // Assert
    expect(core.size).toBe(67);
    expect(core.has('h5p.classes.php')).toBe(true);
    expect(editor.has('scripts/h5peditor.js')).toBe(true);
    expect(editor.has('language/nn.js') && editor.has('language/nb.js')).toBe(true);
  });
});
