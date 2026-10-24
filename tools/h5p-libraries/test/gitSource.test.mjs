/**
 * Tests that a checkout reused from the cache is proved to be at its pinned commit, with its tracked files as
 * committed, before it is copied: the pinned commit passes, another commit, an edited or deleted tracked file or a
 * folder without a checkout of its own fails, and untracked files (a build's output) are outside the proof. Uses a
 * local git repository, so it needs no network.
 *
 * Spec: H5P-003
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { verifiedHead } from '../gitSource.mjs';

const dirs = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const git = (dir, ...args) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
    cwd: dir,
    encoding: 'utf8',
  }).trim();

/** A repository with two commits; returns its folder and both hashes, HEAD at the second. */
function repository() {
  const dir = mkdtempSync(join(tmpdir(), 'h5p-git-'));
  dirs.push(dir);
  git(dir, 'init', '--quiet');
  const commits = ['1.0.0', '1.0.1'].map((version) => {
    writeFileSync(join(dir, 'library.json'), JSON.stringify({ version }));
    git(dir, 'add', 'library.json');
    git(dir, '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', version);
    return git(dir, 'rev-parse', 'HEAD');
  });
  return { dir, first: commits[0], second: commits[1] };
}

describe('[H5P-003] a reused library checkout', () => {
  it('[H5P-003] passes at its pinned commit and fails at another one, naming both', () => {
    // Arrange
    const { dir, first, second } = repository();
    // Act and assert
    expect(verifiedHead(dir, second)).toBe(second);
    expect(() => verifiedHead(dir, first)).toThrow(`${dir} is at ${second}, expected ${first}`);
  });

  it('[H5P-003] fails when a tracked file was edited or deleted, naming the files', () => {
    // Arrange
    const { dir, second } = repository();
    writeFileSync(join(dir, 'semantics.json'), '[]');
    git(dir, 'add', 'semantics.json');
    git(dir, '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'semantics');
    const head = git(dir, 'rev-parse', 'HEAD');
    writeFileSync(join(dir, 'library.json'), JSON.stringify({ version: '9.9.9' }));
    rmSync(join(dir, 'semantics.json'));
    // Act
    const reuse = () => verifiedHead(dir, head);
    // Assert
    expect(head).not.toBe(second);
    expect(reuse).toThrow(`${dir} has tracked files that differ from ${head}: library.json, semantics.json`);
  });

  it('[H5P-003] leaves untracked files (a build’s output) outside the proof', () => {
    const { dir, second } = repository();
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'main.js'), 'built();');
    expect(verifiedHead(dir, second)).toBe(second);
  });

  it('[H5P-003] fails for a folder that holds no checkout of its own', () => {
    const empty = mkdtempSync(join(tmpdir(), 'h5p-git-'));
    dirs.push(empty);
    expect(() => verifiedHead(empty, 'a'.repeat(40))).toThrow('holds no checkout');
  });
});
