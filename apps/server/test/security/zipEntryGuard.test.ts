/**
 * Tests for package inspection before extraction: zip-slip, absolute paths, symlinks, entry and size limits.
 *
 * Spec: SEC-005
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yazl from 'yazl';
import { inspectZip, ZipRejectedError, type ZipLimits } from '../../src/security/zipEntryGuard.js';
import { t } from '../../src/i18n/translate.js';

const dir = mkdtempSync(join(tmpdir(), 'zip-guard-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;

/** A file to put in a test archive; `mode` sets Unix permission bits (e.g. a symlink). */
interface Entry {
  name: string;
  data?: Buffer;
  mode?: number;
}

/**
 * Writes a zip. yazl refuses unsafe names, so each entry is written under a safe stand-in of the same
 * length and the bytes of the name are patched afterwards; the CRC does not cover names.
 */
async function writeZip(entries: Entry[]): Promise<string> {
  const zip = new yazl.ZipFile();
  const swaps: [string, string][] = [];
  for (const [i, e] of entries.entries()) {
    const safe = e.name.replace(/[^A-Za-z0-9_.-]/g, () => 'x').replace(/\.\./g, `q${i}`.slice(0, 2));
    if (safe !== e.name) swaps.push([safe, e.name]);
    zip.addBuffer(e.data ?? Buffer.from('x'), safe, e.mode === undefined ? {} : { mode: e.mode });
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(chunk as Buffer);
  let bytes = Buffer.concat(chunks);
  for (const [safe, real] of swaps)
    bytes = Buffer.from(bytes.toString('latin1').split(safe).join(real), 'latin1');
  const path = join(dir, `t${(counter += 1)}.zip`);
  writeFileSync(path, bytes);
  return path;
}

const rejection = async (path: string, limits?: ZipLimits) => {
  const error = await inspectZip(path, limits).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ZipRejectedError);
  return error as ZipRejectedError;
};

describe('[SEC-005] package archive safety', () => {
  it('[SEC-005] accepts a normal package and reports its entries and size', async () => {
    const path = await writeZip([
      { name: 'h5p.json' },
      { name: 'content/content.json', data: Buffer.alloc(100) },
    ]);
    expect(await inspectZip(path)).toEqual({ entries: 2, totalSize: 101 });
  });

  it('[SEC-005] rejects zip-slip paths', async () => {
    const error = await rejection(await writeZip([{ name: '../evil.js' }]));
    expect(error.messageKey).toBe('upload.archive.unsafePath');
    expect(t(error.messageKey, error.params, 'en')).toBe(
      'The archive contains an invalid file path: “../evil.js”.',
    );
  });

  it('[SEC-005] rejects absolute and backslash paths', async () => {
    for (const name of ['/etc/cron', '..\\evil.js', 'C:/evil.js']) {
      expect((await rejection(await writeZip([{ name }]))).messageKey, name).toBe(
        'upload.archive.unsafePath',
      );
    }
  });

  it('[SEC-005] rejects dot and empty segments and repeated names, which extract over another entry', async () => {
    // WHY: Lumi writes each entry to path.join(folder, name), so all of these land on an existing entry's file.
    for (const name of ['content/./content.json', 'content//content.json', './h5p.json']) {
      const path = await writeZip([{ name: 'content/content.json' }, { name }]);
      expect((await rejection(path)).messageKey, name).toBe('upload.archive.unsafePath');
    }
    const twice = await rejection(await writeZip([{ name: 'h5p.json' }, { name: 'h5p.json' }]));
    expect(twice.params).toEqual({ entry: 'h5p.json' });
    const folders = await writeZip([{ name: 'content/' }, { name: 'content/a.json' }]);
    expect(await inspectZip(folders)).toEqual({ entries: 2, totalSize: 2 });
  });

  it('[SEC-005] rejects symbolic links', async () => {
    const error = await rejection(
      await writeZip([{ name: 'content/link', data: Buffer.from('/etc/passwd'), mode: 0o120777 }]),
    );
    expect(error.messageKey).toBe('upload.archive.symlink');
  });

  it('[SEC-005] rejects too many entries', async () => {
    const path = await writeZip(Array.from({ length: 4 }, (_, i) => ({ name: `f${i}.txt` })));
    const error = await rejection(path, { maxEntries: 3, maxFileSize: 1000, maxTotalSize: 1000 });
    expect(error).toMatchObject({ messageKey: 'upload.archive.tooManyEntries', params: { max: 3 } });
  });

  it('[SEC-005] rejects an oversize entry at the default 50 MB limit', async () => {
    const path = await writeZip([{ name: 'content/video.mp4', data: Buffer.alloc(50 * 1024 * 1024 + 1) }]);
    const error = await rejection(path);
    expect(error).toMatchObject({
      messageKey: 'upload.archive.fileTooLarge',
      params: { entry: 'content/video.mp4', maxMb: 50 },
    });
  });

  it('[SEC-005] rejects a package whose unpacked total exceeds the limit', async () => {
    const path = await writeZip([
      { name: 'a.bin', data: Buffer.alloc(600) },
      { name: 'b.bin', data: Buffer.alloc(600) },
    ]);
    const error = await rejection(path, { maxEntries: 10, maxFileSize: 1000, maxTotalSize: 1000 });
    expect(error.messageKey).toBe('upload.archive.totalTooLarge');
  });

  it('[SEC-005] rejects a file that is not a zip archive', async () => {
    const path = join(dir, 'not-a-zip.h5p');
    writeFileSync(path, '<html>not a package</html>');
    expect((await rejection(path)).messageKey).toBe('upload.archive.unreadable');
  });
});
