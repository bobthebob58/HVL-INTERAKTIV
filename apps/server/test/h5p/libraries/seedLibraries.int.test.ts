/**
 * Integration tests for offline seeding: an empty library storage is seeded from a verified folder, a second
 * run changes nothing, any folder or hash problem stops the run before the first install, and every new or
 * patched library is audited.
 *
 * Spec: H5P-003, H5P-011, SEC-005
 */
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { PrismaLibraryAuditSink } from '../../../src/h5p/libraries/LibraryAuditSink.js';
import { LibraryInstaller } from '../../../src/h5p/libraries/LibraryInstaller.js';
import { seedLibraries, SHA256SUMS_FILE } from '../../../src/h5p/libraries/seedLibraries.js';
import { sha256File } from '../../../src/h5p/libraries/sha256Sums.js';
import { buildH5pPackage, removeBuiltPackages } from '../../support/h5pPackageBuilder.js';
import { openHttpTestbed, type HttpTestbed } from '../../support/httpTestbed.js';
import { describeWithServices } from '../../support/services.js';
import { MULTI_CHOICE, QUESTION_SET } from '../../support/tenTypeLibraries.js';

const folders: string[] = [];

/** A seed folder with the given packages and a SHA256SUMS that lists them (or the given lines). */
async function seedFolder(packages: string[], sums?: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'seed-'));
  folders.push(dir);
  const lines: string[] = [];
  for (const path of packages) {
    copyFileSync(path, join(dir, basename(path)));
    lines.push(`${await sha256File(path)}  ${basename(path)}`);
  }
  writeFileSync(join(dir, SHA256SUMS_FILE), sums ?? `${lines.join('\n')}\n`);
  return dir;
}

describeWithServices('seedLibraries', () => {
  let tb: HttpTestbed;
  let installer: LibraryInstaller;
  let mc: string;
  let qs: string;
  const installed = async () =>
    Object.values(await tb.runtime.editor.libraryManager.listInstalledLibraries()).flat().length;
  const audits = (sha256s: string[]) =>
    tb.db.libraryAuditEvent.findMany({ where: { sha256: { in: sha256s } } });

  beforeAll(async () => {
    tb = await openHttpTestbed([]);
    installer = new LibraryInstaller(
      tb.runtime.editor.packageImporter,
      new PrismaLibraryAuditSink(tb.db),
      tb.runtime.editor.libraryManager,
    );
    mc = await buildH5pPackage({ main: MULTI_CHOICE }, 'H5P.MultiChoice.h5p');
    qs = await buildH5pPackage({ main: QUESTION_SET, libraries: [MULTI_CHOICE] }, 'H5P.QuestionSet.h5p');
  }, 60_000);
  afterAll(async () => {
    const hashes = await Promise.all([mc, qs].map(sha256File));
    await tb.db.libraryAuditEvent.deleteMany({ where: { sha256: { in: hashes } } });
    folders.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
    removeBuiltPackages();
    await tb.close();
  });

  it('[H5P-003] a wrong hash, an unlisted or a missing package stops the run before anything is installed', async () => {
    // WHY: the first package (by name) is fine; only the second is wrong, so an early install would show.
    const flipped = (await sha256File(qs)).replace(/^./, (c) => (c === '0' ? '1' : '0'));
    const wrongHash = await seedFolder(
      [mc, qs],
      `${await sha256File(mc)}  ${basename(mc)}\n${flipped}  ${basename(qs)}\n`,
    );
    await expect(seedLibraries(wrongHash, installer)).rejects.toThrow(/does not match/);
    const unlisted = await seedFolder([mc, qs], `${await sha256File(mc)}  ${basename(mc)}\n`);
    await expect(seedLibraries(unlisted, installer)).rejects.toThrow(/not listed/);
    const missing = await seedFolder(
      [mc],
      `${await sha256File(mc)}  ${basename(mc)}\n${'0'.repeat(64)}  Gone.h5p\n`,
    );
    await expect(seedLibraries(missing, installer)).rejects.toThrow(/missing/);
    expect(await installed()).toBe(0);
  });

  it('[H5P-003] seeds an empty library storage without the Hub, and a second run changes nothing', async () => {
    const dir = await seedFolder([mc, qs]);
    expect(await seedLibraries(dir, installer)).toEqual({ packages: 2, installed: 2, updated: 0 });
    const author = asAccountUser((await tb.actor('author')).actor);
    const info = await tb.runtime.editor.getContentTypeCache(author, 'nn');
    expect(info.libraries.map((l) => l.machineName).sort()).toEqual(['H5P.MultiChoice', 'H5P.QuestionSet']);
    expect(await installed()).toBe(2);
    const before = (await audits([await sha256File(mc), await sha256File(qs)])).length;
    expect(await seedLibraries(dir, installer)).toEqual({ packages: 2, installed: 0, updated: 0 });
    expect((await audits([await sha256File(mc), await sha256File(qs)])).length).toBe(before);
  });

  it('[H5P-011] each new or patched library gets one seed audit row with the package hash and no actor', async () => {
    const patched = await buildH5pPackage(
      { main: { ...MULTI_CHOICE, patchVersion: 2 } },
      'H5P.MultiChoice-patch.h5p',
    );
    const hash = await sha256File(patched);
    expect(await seedLibraries(await seedFolder([patched]), installer)).toEqual({
      packages: 1,
      installed: 0,
      updated: 1,
    });
    expect(await audits([hash])).toEqual([
      expect.objectContaining({
        source: 'seed',
        actorUserId: null,
        machineName: 'H5P.MultiChoice',
        fromVersion: '1.16.0',
        toVersion: '1.16.2',
      }),
    ]);
    await tb.db.libraryAuditEvent.deleteMany({ where: { sha256: hash } });
  });

  it('[SEC-005] a pinned package with an unsafe archive entry is still refused', async () => {
    const slip = await buildH5pPackage({ main: MULTI_CHOICE, files: { 'xx/evil.js': 'x' } }, 'Slip.h5p');
    writeFileSync(
      slip,
      Buffer.from(readFileSync(slip).toString('latin1').split('xx/evil.js').join('../evil.js'), 'latin1'),
    );
    await expect(seedLibraries(await seedFolder([slip]), installer)).rejects.toMatchObject({
      messageKey: 'upload.archive.unsafePath',
    });
  });
});
