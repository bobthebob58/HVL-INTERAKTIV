/**
 * Unit tests of the limit for one activity's files as a save is checked against it: which references count, where
 * each size is read, and the refusal before anything is written (D-139).
 *
 * Spec: SEC-005, PROD-007
 */
import type { ILibraryName, IUser } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_FILE_LIMITS,
  ACTIVITY_FILES_OVER_LIMIT,
  ActivityFileBudget,
  activityFilesOverLimit,
  type ScannedFile,
} from '../../src/h5p/activityFileBudget.js';
import { MAX_TOTAL_SIZE } from '../../src/h5p/H5pConfigFactory.js';
import { toErrorResponse } from '../../src/http/h5pErrorResponse.js';
import { t, type Locale } from '../../src/i18n/translate.js';

const MAIN = { machineName: 'H5P.Column', majorVersion: 1, minorVersion: 22 } as ILibraryName;
const USER = { id: 'u1', name: '', email: '', type: 'local' } as IUser;
const OWN = '0192f0c4-0000-7000-8000-00000000aaaa';
const OTHER = '0192F0C4-0000-7000-8000-00000000BBBB';

/** A budget over the given references whose every readable file has the size its name ends with. */
function budgetOver(refs: readonly ScannedFile[], limits = { files: 3, bytes: 10 }) {
  const read: string[] = [];
  const sizeOf = (where: string, name: string) => {
    read.push(`${where}/${name}`);
    const size = Number(/-(\d+)\.\w+$/.exec(name)?.[1]);
    return Number.isNaN(size) ? Promise.reject(new Error('no such file')) : Promise.resolve({ size });
  };
  const budget = new ActivityFileBudget(
    async () => refs,
    {
      contentManager: { getContentFileStats: (id, name) => sizeOf(id, name) as never },
      temporaryFileManager: { getFileStats: (name) => sizeOf('#tmp', name) as never },
    },
    limits,
  );
  return {
    read,
    check: () => budget.enforce(OWN, {}, MAIN, USER),
    checkNew: () => budget.enforce(undefined, {}, MAIN, USER),
  };
}
const kept = (name: string): ScannedFile => ({ filePath: name, temporary: false });
const upload = (name: string): ScannedFile => ({ filePath: `${name}#tmp`, temporary: true });
const OVER = { errorId: ACTIVITY_FILES_OVER_LIMIT, httpStatusCode: 413 };

describe('[SEC-005] the limit for one activity’s files', () => {
  it('[SEC-005] is what one imported package may bring: 200 MB, and 1 000 files', () => {
    expect(ACTIVITY_FILE_LIMITS).toEqual({ files: 1000, bytes: MAX_TOTAL_SIZE });
  });

  it.each(['nn', 'nb', 'en'] as Locale[])('[SEC-005] tells the author both limits in %s', (locale) => {
    // Act
    const { status, body } = toErrorResponse(activityFilesOverLimit(), locale);
    // Assert
    expect({ status, code: body.errorCode }).toEqual({ status: 413, code: ACTIVITY_FILES_OVER_LIMIT });
    expect(body.message).toBe(t('h5p.activityFilesOverLimit', { maxFiles: '1000', maxMb: '200' }, locale));
    for (const part of ['1000', '200 MB', 'Panopto']) expect(body.message).toContain(part);
  });

  it('[SEC-005] reads an upload from temporary storage, a pasted file from its source and a kept file from the activity', async () => {
    // Arrange: 3 + 3 + 4 bytes, exactly the limit
    const { read, check } = budgetOver([
      upload('images/new-3.png'),
      kept(`../${OTHER}/images/pasted-3.png`),
      kept('images/kept-4.png'),
    ]);
    // Act
    await check();
    // Assert: a pasted file is read from the source under its stored (lower-case) ID
    expect(read).toEqual([
      '#tmp/images/new-3.png',
      `${OTHER.toLowerCase()}/images/pasted-3.png`,
      `${OWN}/images/kept-4.png`,
    ]);
  });

  it('[SEC-005] refuses one byte past the limit, and stops reading there', async () => {
    const { read, check } = budgetOver([kept('a-6.png'), kept('b-5.png'), kept('c-1.png')]);
    await expect(check()).rejects.toMatchObject({ ...OVER, replacements: { maxFiles: '3', maxMb: '0' } });
    expect(read).toHaveLength(2);
  });

  it('[SEC-005] refuses one file past the limit before any size is read', async () => {
    const { read, check } = budgetOver([
      kept('a-1.png'),
      kept('b-1.png'),
      kept('c-1.png'),
      upload('d-1.png'),
    ]);
    await expect(check()).rejects.toMatchObject(OVER);
    expect(read).toEqual([]);
  });

  it('[SEC-005] counts a reference once, and neither a web address nor a file that cannot be read', async () => {
    // Arrange: the same file twice, a video on the web, and a reference to a file that is not there
    const { check } = budgetOver([
      kept('a-9.png'),
      kept('a-9.png'),
      kept('https://video.example/film.mp4'),
      kept('images/missing.png'),
    ]);
    // Act and assert
    await expect(check()).resolves.toBeUndefined();
  });

  it('[PROD-007] a new activity counts its uploads and pasted files; it has no kept file yet', async () => {
    const { read, checkNew } = budgetOver([
      upload('new-2.png'),
      kept(`../${OTHER}/p-2.png`),
      kept('loose-9.png'),
    ]);
    await checkNew();
    expect(read).toEqual(['#tmp/new-2.png', `${OTHER.toLowerCase()}/p-2.png`]);
  });
});
