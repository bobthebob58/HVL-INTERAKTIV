/**
 * Tests for the SHA256SUMS parser and file hashing used to pin the seed packages.
 *
 * Spec: H5P-003, H5P-011
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSha256Sums, sha256File } from '../../../src/h5p/libraries/sha256Sums.js';

const dir = mkdtempSync(join(tmpdir(), 'sha-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const HASH = 'a'.repeat(64);

describe('[H5P-003] SHA256SUMS', () => {
  it('[H5P-003] reads sha256sum lines, with comments, blank lines and the binary marker', () => {
    const sums = parseSha256Sums(
      `# seed packages\n\n${HASH}  H5P.MultiChoice-1.16.14.h5p\n${'B'.repeat(64)} *H5P.Blanks-1.14.13.h5p\n`,
    );
    expect([...sums]).toEqual([
      ['H5P.MultiChoice-1.16.14.h5p', HASH],
      ['H5P.Blanks-1.14.13.h5p', 'b'.repeat(64)],
    ]);
  });

  it('[H5P-003] refuses malformed lines, folders and duplicate names', () => {
    expect(() => parseSha256Sums(`${HASH.slice(1)}  a.h5p`)).toThrow('line 1');
    expect(() => parseSha256Sums(`${HASH}  ../a.h5p`)).toThrow('line 1');
    expect(() => parseSha256Sums(`${HASH}  a.h5p\n${HASH}  a.h5p`)).toThrow('twice');
  });

  it('[H5P-011] hashes a file as sha256sum does', async () => {
    const file = join(dir, 'abc.txt');
    writeFileSync(file, 'abc');
    expect(await sha256File(file)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
