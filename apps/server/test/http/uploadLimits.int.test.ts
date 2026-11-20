/**
 * Integration tests for the per-person limits on what an author sends (D-120): file uploads, package imports, and
 * SVG files that the cleaning refused as too complex.
 *
 * Spec: SEC-005, SEC-001
 */
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { FileSanitizerResult, type IFileSanitizer } from '@lumieducation/h5p-server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  IMPORTS_PER_TEN_MINUTES,
  SLOW_SVGS_PER_TEN_MINUTES,
  UPLOADS_PER_TEN_MINUTES,
} from '../../src/http/h5pRouteLimits.js';
import { RejectedUploadError } from '../../src/security/RejectedUploadError.js';
import { buildH5pPackage, removeBuiltPackages } from '../support/h5pPackageBuilder.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { requestAs } from '../support/requestAs.js';
import { describeWithServices } from '../support/services.js';
import { MULTI_CHOICE } from '../support/tenTypeLibraries.js';
import { PNG_1X1, uploadEditorFile } from '../support/uploadFixtures.js';

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>');
const uploadFolders = () => readdirSync(tmpdir()).filter((name) => name.startsWith('hvli-upload-')).length;
/** The number of upload folders once the last request's own clean-up, which follows its answer, has run. */
const settledUploadFolders = async (expected: number): Promise<number> => {
  for (let tries = 0; tries < 100 && uploadFolders() !== expected; tries += 1) await delay(20);
  return uploadFolders();
};

describeWithServices('[SEC-005] per-person limits on uploads and imports', () => {
  let tb: HttpTestbed;
  beforeAll(async () => {
    tb = await openHttpTestbed();
  }, 60_000);
  afterAll(async () => {
    removeBuiltPackages();
    await tb.close();
  });

  it('[SEC-005] file uploads past an author’s limit are 429 with Retry-After and leave no folder; others go on', async () => {
    // Arrange
    const [author, colleague] = [await tb.actor('author'), await tb.actor('author')];
    const folders = uploadFolders();
    // Act
    const statuses = new Set<number>();
    for (let n = 0; n < UPLOADS_PER_TEN_MINUTES; n += 1) {
      statuses.add((await uploadEditorFile(tb.app, author, `bilde-${n}.png`, PNG_1X1)).status);
    }
    const past = await uploadEditorFile(tb.app, author, 'ein-for-mykje.png', PNG_1X1);
    const other = await uploadEditorFile(tb.app, colleague, 'bilde.png', PNG_1X1);
    // Assert
    expect(statuses).toEqual(new Set([200]));
    expect(past.status).toBe(429);
    expect(Number(past.headers['retry-after'])).toBeGreaterThan(0);
    expect(past.body).toMatchObject({ errorCode: 'hvl:rate-limited' });
    expect(other.status).toBe(200);
    expect(await settledUploadFolders(folders)).toBe(folders);
  }, 120_000);

  it('[SEC-005] package imports past an author’s limit are 429 with Retry-After; others go on', async () => {
    // Arrange
    const [author, colleague] = [await tb.actor('author'), await tb.actor('author')];
    const path = await buildH5pPackage({ main: MULTI_CHOICE, params: { question: 'Kva?', answers: ['Ja'] } });
    const importAs = (who: TestActor) =>
      requestAs(tb.app, who, 'post', '/h5p/ajax?action=library-upload').attach('h5p', path);
    // Act
    const statuses = new Set<number>();
    for (let n = 0; n < IMPORTS_PER_TEN_MINUTES; n += 1) statuses.add((await importAs(author)).status);
    const past = await importAs(author);
    const other = await importAs(colleague);
    // Assert
    expect(statuses).toEqual(new Set([200]));
    expect(past.status).toBe(429);
    expect(Number(past.headers['retry-after'])).toBeGreaterThan(0);
    expect(other.status).toBe(200);
  }, 120_000);

  it('[SEC-001] after as many SVG files refused as too complex as the budget allows, an author’s further SVGs wait', async () => {
    // Arrange: a sanitiser that finds every SVG named "slow" too complex, as the cleaning worker's time limit would
    const tooComplex: IFileSanitizer = {
      name: 'test: too complex',
      sanitize: async (file) => {
        if (file.endsWith('.svg')) throw new RejectedUploadError('upload.file.svgTooComplex');
        return FileSanitizerResult.Ignored;
      },
    };
    const app = tb.appWith({ fileSanitizers: [tooComplex] });
    const [author, colleague] = [await tb.actor('author'), await tb.actor('author')];
    // Act
    const refused: string[] = [];
    for (let n = 0; n < SLOW_SVGS_PER_TEN_MINUTES; n += 1) {
      const res = await uploadEditorFile(app, author, `slow-${n}.svg`, SVG);
      refused.push(`${res.status} ${(res.body as { errorCode?: string }).errorCode}`);
    }
    const waiting = await uploadEditorFile(app, author, 'ordinary.svg', SVG);
    const picture = await uploadEditorFile(app, author, 'bilde.png', PNG_1X1);
    const other = await uploadEditorFile(app, colleague, 'slow.svg', SVG);
    // Assert
    expect(new Set(refused)).toEqual(new Set(['400 upload.file.svgTooComplex']));
    expect(waiting.status).toBe(429);
    expect(Number(waiting.headers['retry-after'])).toBeGreaterThan(0);
    expect(picture.status).toBe(200);
    expect(other.body).toMatchObject({ errorCode: 'upload.file.svgTooComplex' });
  });
});
