/**
 * backupFolder — the layout of one backup on disk: its name, its manifest, its `SHA256SUMS`, and which older backups
 * the retention removes.
 *
 * Why: a restore must be able to tell a whole, unchanged backup from a damaged or altered one before it writes
 *      anything (NFR-002's "tested restore"), and NFR-002 keeps backups 30 days. D-110's backup amendment of
 *      2026-11-05 fixes the layout: `database.dump`, `objects/<sha256>`, `MANIFEST.json` and `SHA256SUMS`.
 * Spec: NFR-002
 * Invariants:
 *   - `SHA256SUMS` lists every file of the folder but itself; verification reports a changed, missing or extra file,
 *     and a listed path that is absolute or leaves the folder, by its path in the folder.
 *   - Only names `hvli-backup-<yyyymmddThhmmssZ>` are backups; retention never selects any other name or the
 *     newest backup, whatever its age. A `.hvli-backup-<time>.partial` folder older than a day is a run that was
 *     stopped (SIGTERM, SIGKILL, a reboot) before it could remove it, and is removed too.
 *   - The manifest names its format; a manifest of another format is refused.
 * Collaborators: ./backupRun.mjs.
 * Tests: tools/ops/test/backupFolder.test.mjs
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, sep } from 'node:path';

/** The manifest's format name. */
export const MANIFEST_FORMAT = 'hvli-backup-1';
/** A backup folder's name. */
export const BACKUP_NAME = /^hvli-backup-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
/** The checksum list's file name. */
export const CHECKSUMS = 'SHA256SUMS';

/**
 * The folder name of a backup made at `at`.
 * @param {Date} at - The backup's time.
 * @returns {string} e.g. `hvli-backup-20261105T030000Z`.
 */
export const backupName = (at) =>
  `hvli-backup-${at
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '')}`;

/**
 * The time in a backup's name.
 * @param {string} name - A folder name.
 * @returns {Date | undefined} Its time, or undefined for a name that is not a backup's.
 */
export function backupTime(name) {
  const m = BACKUP_NAME.exec(name);
  if (!m) return undefined;
  const at = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

/**
 * The backups the retention removes: older than `keepDays`, never the newest one.
 * @param {string[]} names - The folder names next to the new backup.
 * @param {Date} now - The time of the new backup.
 * @param {number} keepDays - How many days backups are kept.
 * @returns {string[]} Names to remove.
 */
export function expiredBackups(names, now, keepDays) {
  const dated = names
    .map((name) => ({ name, at: backupTime(name) }))
    .filter((entry) => entry.at !== undefined)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const limit = now.getTime() - keepDays * 24 * 60 * 60 * 1000;
  return dated
    .slice(1)
    .filter((entry) => entry.at.getTime() < limit)
    .map((entry) => entry.name);
}

/** A backup folder still being written, or left by a run that was stopped. */
export const PARTIAL_NAME = /^\.(hvli-backup-\d{8}T\d{6}Z)\.partial$/;
/** Age after which a partial folder is a stopped run's: no backup takes a day. */
export const STALE_PARTIAL_MS = 24 * 60 * 60 * 1000;

/**
 * The partial folders that stopped runs left behind.
 * @param {string[]} names - The folder names next to the new backup.
 * @param {Date} now - The time of the new backup.
 * @returns {string[]} Names of partial folders begun more than `STALE_PARTIAL_MS` before `now`.
 */
export function stalePartials(names, now) {
  // PRIVACY: a stopped run's folder holds learner rows; without this it would outlive the retention.
  return names.filter((name) => {
    const at = backupTime(PARTIAL_NAME.exec(name)?.[1] ?? '');
    return at !== undefined && at.getTime() < now.getTime() - STALE_PARTIAL_MS;
  });
}

const sha256Of = async (file) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};

const filesIn = async (dir) =>
  (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((path) => path !== CHECKSUMS)
    .sort();

/**
 * Writes `SHA256SUMS` for every file of a folder.
 * @param {string} dir - The backup folder.
 * @returns {Promise<number>} How many files it lists.
 */
export async function writeChecksums(dir) {
  const files = await filesIn(dir);
  const lines = [];
  for (const path of files) lines.push(`${await sha256Of(join(dir, path))}  ${path}`);
  await writeFile(join(dir, CHECKSUMS), `${lines.join('\n')}\n`, { mode: 0o600 });
  return files.length;
}

/**
 * Checks a folder against its `SHA256SUMS`.
 * @param {string} dir - The backup folder.
 * @returns {Promise<{files: number, problems: string[]}>} How many files were checked, and one message per
 *   problem, naming the path in the folder.
 */
export async function verifyChecksums(dir) {
  let text;
  try {
    text = await readFile(join(dir, CHECKSUMS), 'utf8');
  } catch {
    return { files: 0, problems: [`${CHECKSUMS} is missing`] };
  }
  const problems = [];
  const listed = new Map();
  for (const line of text.split('\n').filter(Boolean)) {
    const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    const path = m?.[2];
    if (!m || isAbsolute(path) || normalize(path).split(/[\\/]/).includes('..')) {
      problems.push(`${CHECKSUMS} has a line this tool does not accept`);
      continue;
    }
    listed.set(path, m[1]);
  }
  const present = new Set(await filesIn(dir));
  for (const [path, sha256] of listed) {
    if (!present.has(path)) problems.push(`${path} is missing`);
    else if ((await sha256Of(join(dir, path))) !== sha256) problems.push(`${path} has changed`);
  }
  for (const path of present) if (!listed.has(path)) problems.push(`${path} is not in ${CHECKSUMS}`);
  return { files: listed.size, problems };
}

/**
 * Writes the manifest.
 * @param {string} dir - The backup folder.
 * @param {object} manifest - The manifest without its format.
 */
export const writeManifest = (dir, manifest) =>
  writeFile(
    join(dir, 'MANIFEST.json'),
    `${JSON.stringify({ format: MANIFEST_FORMAT, ...manifest }, null, 2)}\n`,
    {
      mode: 0o600,
    },
  );

/**
 * Reads and checks the manifest's shape.
 * @param {string} dir - The backup folder.
 * @returns {Promise<{postgresMajor: number, database: {file: string, tables: Record<string, number>},
 *   buckets: {content: {objects: {key: string, size: number, sha256: string, contentType?: string}[]}}}>} It.
 * @throws {Error} When it is missing, of another format or incomplete.
 */
export async function readManifest(dir) {
  const manifest = JSON.parse(await readFile(join(dir, 'MANIFEST.json'), 'utf8'));
  const objects = manifest?.buckets?.content?.objects;
  if (
    manifest?.format !== MANIFEST_FORMAT ||
    !Number.isInteger(manifest.postgresMajor) ||
    manifest.database?.file !== 'database.dump' ||
    typeof manifest.database?.tables !== 'object' ||
    !Array.isArray(objects) ||
    !objects.every((o) => typeof o.key === 'string' && /^[0-9a-f]{64}$/.test(o.sha256))
  ) {
    throw new Error(`MANIFEST.json is not a ${MANIFEST_FORMAT} manifest`);
  }
  return manifest;
}
