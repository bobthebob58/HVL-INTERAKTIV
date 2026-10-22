/**
 * sha256Sums — SHA-256 of package files and the `SHA256SUMS` list that pins the seed packages.
 *
 * Why: the ten content types are installed only from packages whose hashes were recorded when they were
 *      downloaded and reviewed (`H5P-003`), and every library change is audited with its package hash
 *      (`H5P-011`). The list uses the `sha256sum` format so anyone can re-check it by hand.
 * Spec: H5P-003, H5P-011
 * Invariants:
 *   - Lines are `<64 hex>  <file name>` (two spaces; `*` binary marker allowed); comments and blank lines are
 *     ignored; anything else, a path with a folder, or a duplicate file name is an error.
 *   - Hashes are lower-case hex.
 * Collaborators: ./seedLibraries.ts, ./LibraryInstaller.ts, ../HvlH5PEditor.ts (admin imports).
 * Tests: apps/server/test/h5p/libraries/sha256Sums.test.ts
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/**
 * Hashes a file.
 * @param path - File to hash.
 * @returns Lower-case hex SHA-256.
 */
export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/**
 * Parses a `SHA256SUMS` file.
 * @param text - File contents.
 * @returns Hash by file name.
 * @throws Error naming the first malformed line.
 */
export function parseSha256Sums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const match = /^([0-9a-fA-F]{64}) [ *]([^/\\]+)$/.exec(line);
    if (!match?.[1] || !match[2])
      throw new Error(`SHA256SUMS line ${index + 1} is not "<sha256>  <file name>"`);
    if (sums.has(match[2])) throw new Error(`SHA256SUMS lists ${match[2]} twice`);
    sums.set(match[2], match[1].toLowerCase());
  });
  return sums;
}
