/**
 * backupFolder.test — a backup folder's name, the 30-day retention and stopped runs' partial folders, `SHA256SUMS`
 * (changed, missing, extra and escaping paths) and the manifest's format.
 * Spec: NFR-002
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  backupName,
  backupTime,
  CHECKSUMS,
  expiredBackups,
  MANIFEST_FORMAT,
  readManifest,
  stalePartials,
  verifyChecksums,
  writeChecksums,
  writeManifest,
} from '../backupFolder.mjs';

const MANIFEST = {
  postgresMajor: 16,
  database: { file: 'database.dump', tables: { 'public."User"': 2 } },
  buckets: { content: { objects: [{ key: 'content/a/b.png', size: 3, sha256: 'a'.repeat(64) }] } },
};

describe('backup names and retention', () => {
  it('[NFR-002] names a backup by its UTC time and reads the time back', () => {
    // Act
    const name = backupName(new Date('2026-11-05T03:04:05.678Z'));

    // Assert
    expect(name).toBe('hvli-backup-20261105T030405Z');
    expect(backupTime(name)?.toISOString()).toBe('2026-11-05T03:04:05.000Z');
    expect(backupTime('hvli-backup-20261105T030405Z.partial')).toBeUndefined();
    expect(backupTime('.hvli-backup-20261105T030405Z.partial')).toBeUndefined();
  });

  it('[NFR-002] removes backups older than the retention, never the newest and never another name', () => {
    // Arrange
    const now = new Date('2026-11-05T03:00:00Z');
    const names = [
      'hvli-backup-20261105T030000Z',
      'hvli-backup-20261006T030000Z',
      'hvli-backup-20261005T020000Z',
      'hvli-backup-20260101T000000Z',
      'notes.txt',
      'hvli-backup-old',
      '.hvli-backup-20260101T000000Z.partial',
    ];

    // Act
    const expired = expiredBackups(names, now, 30);

    // Assert
    expect(expired.sort()).toEqual(['hvli-backup-20260101T000000Z', 'hvli-backup-20261005T020000Z']);
    expect(expiredBackups(['hvli-backup-20200101T000000Z'], now, 30)).toEqual([]);
  });

  it('[NFR-002] removes the partial folder a stopped run left, once it is a day old, and nothing else', () => {
    // Arrange: a run killed yesterday, a run still writing, and names that are not partial backups
    const now = new Date('2026-11-05T03:00:00Z');
    const names = [
      '.hvli-backup-20261104T021700Z.partial',
      '.hvli-backup-20261105T025900Z.partial',
      'hvli-backup-20261104T021700Z',
      '.hvli-backup-20261104T021700Z.partial.keep',
      '.other-20261104T021700Z.partial',
    ];

    // Act
    const stale = stalePartials(names, now);

    // Assert
    expect(stale).toEqual(['.hvli-backup-20261104T021700Z.partial']);
  });
});

describe('a backup folder checked against its SHA256SUMS', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hvli-backup-folder-'));
    await mkdir(join(dir, 'objects'));
    await writeFile(join(dir, 'database.dump'), 'dump');
    await writeFile(join(dir, 'objects', 'a'.repeat(64)), 'png');
    await writeManifest(dir, MANIFEST);
    await writeChecksums(dir);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('[NFR-002] lists every file but itself and finds nothing wrong in an unchanged folder', async () => {
    // Act
    const result = await verifyChecksums(dir);

    // Assert
    expect(result).toEqual({ files: 3, problems: [] });
    expect((await readManifest(dir)).format).toBe(MANIFEST_FORMAT);
  });

  it('[NFR-002] names a changed, a missing and an extra file', async () => {
    // Arrange
    await writeFile(join(dir, 'database.dump'), 'dumq');
    await rm(join(dir, 'objects', 'a'.repeat(64)));
    await writeFile(join(dir, 'objects', 'planted'), 'x');

    // Act
    const { problems } = await verifyChecksums(dir);

    // Assert
    expect(problems.sort()).toEqual(
      [
        `database.dump has changed`,
        `objects/${'a'.repeat(64)} is missing`,
        `objects/planted is not in ${CHECKSUMS}`,
      ].sort(),
    );
  });

  it('[NFR-002] refuses a checksum line whose path leaves the folder or is absolute', async () => {
    // Arrange
    await writeFile(
      join(dir, CHECKSUMS),
      `${'0'.repeat(64)}  ../../etc/passwd\n${'0'.repeat(64)}  /etc/passwd\n`,
    );

    // Act
    const { problems } = await verifyChecksums(dir);

    // Assert
    expect(problems.filter((p) => /does not accept/.test(p))).toHaveLength(2);
    expect(problems.join('\n')).not.toMatch(/passwd/);
  });

  it('[NFR-002] refuses a folder without SHA256SUMS and a manifest of another format', async () => {
    // Arrange
    await rm(join(dir, CHECKSUMS));
    const other = await mkdtemp(join(tmpdir(), 'hvli-backup-other-'));
    await writeFile(join(other, 'MANIFEST.json'), JSON.stringify({ ...MANIFEST, format: 'hvli-backup-0' }));

    // Act
    const missing = await verifyChecksums(dir);
    const reading = readManifest(other);

    // Assert
    expect(missing.problems).toEqual([`${CHECKSUMS} is missing`]);
    await expect(reading).rejects.toThrow(/not a hvli-backup-1 manifest/);
    await rm(other, { recursive: true, force: true });
  });
});
