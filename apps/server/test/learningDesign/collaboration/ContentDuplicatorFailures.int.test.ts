/**
 * Integration tests of a duplicate that goes wrong (D-092 amendment): a copy Lumi saved incompletely, a save that
 * failed after Lumi wrote the row, and a failed record are all removed, rows and files, and answer 500
 * `hvl:duplicate-failed`; a refusal the editor raises before writing anything is passed on as it is.
 *
 * Spec: PROD-007
 */
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { H5pError } from '@lumieducation/h5p-server';
import { toErrorResponse } from '../../../src/http/h5pErrorResponse.js';
import { t } from '../../../src/i18n/translate.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { openDuplicatorBench, type DuplicatorBench } from './duplicatorBench.js';

type Injection = (bench: DuplicatorBench) => void;

const FAILURES: [string, Injection][] = [
  [
    'Lumi could not read a source file and emptied its path',
    (bench) => {
      const manager = bench.tb.runtime.editor.contentManager;
      vi.spyOn(manager, 'getContentFileStream').mockRejectedValueOnce(new Error('storage unavailable'));
    },
  ],
  [
    'Lumi’s second write of the parameters failed after the row was created',
    (bench) => {
      const manager = bench.tb.runtime.editor.contentManager;
      const write = manager.createOrUpdateContent.bind(manager);
      let calls = 0;
      vi.spyOn(manager, 'createOrUpdateContent').mockImplementation(async (...args) => {
        calls += 1;
        if (calls === 2) throw new Error('database unavailable');
        return write(...args);
      });
    },
  ],
  [
    'recording the copy failed',
    (bench) => void vi.spyOn(bench.tb.db, '$transaction').mockRejectedValueOnce(new Error('deadlock')),
  ],
];

describeWithServices('[PROD-007] a failed duplicate leaves nothing behind', () => {
  describeWithRealPackages('[PROD-007] real content types', () => {
    let bench: DuplicatorBench;

    beforeAll(async () => {
      bench = await openDuplicatorBench();
    }, 180_000);
    afterEach(() => void vi.restoreAllMocks());
    afterAll(() => bench.close());

    it.each(FAILURES)(
      '[PROD-007] when %s, the copy is removed and the answer is 500',
      async (_name, inject) => {
        // Arrange: a bank source, and a record of what the duplicator removes
        const sourceId = await bench.importExample('H5P.ImageHotspots', true);
        const sourceFiles = await bench.filesOf(sourceId);
        const before = await bench.copierActivityIds();
        const removed = vi.spyOn(bench.tb.runtime.editor.contentStorage, 'deleteContent');
        inject(bench);
        // Act
        const error = await bench.duplicator.duplicate(sourceId, bench.copier.actor).catch((e: unknown) => e);
        // Assert: our own deliberate 500, with the cause kept for the log
        expect(error).toMatchObject({ status: 500, errorCode: 'hvl:duplicate-failed' });
        expect((error as Error).cause).toBeInstanceOf(Error);
        const { status, body } = toErrorResponse(error, 'nn');
        expect({ status, code: body.errorCode }).toEqual({ status: 500, code: 'hvl:duplicate-failed' });
        expect(body.message).toBe(t('learningDesign.error.duplicateFailed', {}, 'nn'));
        // Assert: the row the save created is gone with its files, nothing was recorded, the source is intact
        const [copyId = ''] = removed.mock.calls.map(([id]) => String(id));
        expect(removed).toHaveBeenCalledTimes(1);
        expect(await bench.tb.db.h5PContent.count({ where: { id: copyId } })).toBe(0);
        expect(await bench.tb.db.h5PContentFile.count({ where: { contentId: copyId } })).toBe(0);
        expect(await bench.newCopierRows(before)).toEqual([]);
        expect(await bench.duplicatedEvents(copyId)).toEqual([]);
        expect(await bench.filesOf(sourceId)).toEqual(sourceFiles);
      },
      60_000,
    );

    it('[PROD-007] a refusal the editor raises before writing anything is passed on unchanged', async () => {
      // Arrange
      const sourceId = await bench.importExample('H5P.ImageHotspots', true);
      const refusal = new H5pError('hvl:sub-content-not-allowed', { library: 'H5P.DragQuestion' }, 403);
      vi.spyOn(bench.tb.runtime.editor, 'saveOrUpdateContent').mockRejectedValueOnce(refusal);
      const removed = vi.spyOn(bench.tb.runtime.editor.contentStorage, 'deleteContent');
      // Act
      const error = await bench.duplicator.duplicate(sourceId, bench.copier.actor).catch((e: unknown) => e);
      // Assert
      expect(error).toBe(refusal);
      expect(removed).not.toHaveBeenCalled();
    }, 60_000);
  });
});
