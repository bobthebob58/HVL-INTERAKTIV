/**
 * Integration tests of ContentDuplicator.saveAsCopy, «Lagre som ny versjon» (D-093): the editor's edited parameters,
 * with a new upload, are saved as the owner's copy linked to the original, which stays exactly as it was; an h5p.json
 * Lumi refuses is the author's 400, not a failed copy.
 *
 * Spec: PROD-007, PROD-013
 */
import { Readable } from 'node:stream';
import type { ReadStream } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { toErrorResponse } from '../../../src/http/h5pErrorResponse.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { addPosterAndImageInteraction } from './duplicateFilesBench.js';
import { pastedName } from './duplicateFilesPasteSource.js';
import { openDuplicatorBench, type DuplicatorBench } from './duplicatorBench.js';

describeWithServices('[PROD-013] saving an edit as a copy', () => {
  describeWithRealPackages('[PROD-013] real content types', () => {
    let bench: DuplicatorBench;

    beforeAll(async () => {
      bench = await openDuplicatorBench();
    }, 180_000);
    afterAll(() => bench.close());

    it('[PROD-013] the edited parameters and a new upload become the owner’s copy; the original is untouched', async () => {
      // Arrange: the owner edits their published video, adds a poster upload and sends h5p.json without languages
      const sourceId = await bench.importSaved('H5P.InteractiveVideo', true);
      const [sourceParams, sourceFiles] = [await bench.paramsOf(sourceId), await bench.filesOf(sourceId)];
      const owner = asAccountUser(bench.owner.actor);
      // WHY: Lumi types the stream as fs.ReadStream but only reads it; the bytes do not matter here.
      const stream = Readable.from(['poster']) as unknown as ReadStream;
      const upload = await bench.tb.runtime.editor.temporaryFileManager.addFile(
        'images/poster.png',
        stream,
        owner,
      );
      const edited = structuredClone(sourceParams);
      addPosterAndImageInteraction(edited, `${upload}#tmp`);
      const { defaultLanguage: _d, language: _l, ...sent } = await bench.metadataOf(sourceId);
      // WHY: Lumi types both languages as required; the editor may still leave them out.
      const metadata = { ...sent, title: 'Ny versjon' } as IContentMetadata;
      // Act
      const result = await bench.duplicator.saveAsCopy(sourceId, edited, metadata, bench.owner.actor);
      // Assert: the copy holds the source's files (renamed), the upload once, and no temporary or paste path
      expect(result.via).toBe('edit');
      const names = await bench.fileNames(result.contentId);
      expect(names).toContain(upload);
      expect(names.filter((n) => pastedName('videos/clip.webm').test(n))).toHaveLength(1);
      expect(JSON.stringify(await bench.paramsOf(result.contentId))).not.toMatch(/#tmp|\.\.\//);
      // Assert: the edited title, the source's languages, the link and the audit's kind
      expect(await bench.metadataOf(result.contentId)).toMatchObject({
        title: 'Ny versjon',
        defaultLanguage: 'nn',
        language: 'nn',
      });
      const copy = await bench.tb.db.h5PContent.findUniqueOrThrow({ where: { id: result.contentId } });
      expect(copy).toMatchObject({ sourceContentId: sourceId, status: 'draft', visibility: 'private' });
      const [event] = await bench.duplicatedEvents(result.contentId);
      expect(event?.details).toMatchObject({ via: 'edit', kind: 'save-as-copy' });
      // Assert: the original keeps its parameters, files and status
      expect(await bench.paramsOf(sourceId)).toEqual(sourceParams);
      expect(await bench.filesOf(sourceId)).toEqual(sourceFiles);
      const original = await bench.tb.db.h5PContent.findUniqueOrThrow({ where: { id: sourceId } });
      expect(original.status).toBe('published');
    }, 60_000);

    it('[PROD-013] a colleague who may not copy the activity cannot save it as a copy either', async () => {
      // Arrange: a published activity shared with HVL but not in the bank
      const sourceId = await bench.importExample('H5P.ImageHotspots', true);
      await bench.tb.db.h5PContent.update({ where: { id: sourceId }, data: { bankListedAt: null } });
      const params = await bench.paramsOf(sourceId);
      const metadata = await bench.metadataOf(sourceId);
      // Act
      const error = await bench.duplicator
        .saveAsCopy(sourceId, params, metadata, bench.copier.actor)
        .catch((e: unknown) => e);
      // Assert
      expect(error).toMatchObject({ status: 403, errorCode: 'hvl:duplicate-not-allowed' });
    }, 60_000);

    it('[PROD-013] an h5p.json Lumi’s schema refuses stays the author’s 400 and writes nothing', async () => {
      // Arrange: the owner sends an empty title, which Lumi refuses with a plain Error before it writes
      const sourceId = await bench.importExample('H5P.ImageHotspots', true);
      const params = await bench.paramsOf(sourceId);
      const metadata = { ...(await bench.metadataOf(sourceId)), title: '' };
      const owned = () =>
        bench.tb.db.h5PContent.count({ where: { ownerUserId: bench.owner.actor.accountId } });
      const before = await owned();
      // Act
      const error = await bench.duplicator
        .saveAsCopy(sourceId, params, metadata, bench.owner.actor)
        .catch((e: unknown) => e);
      // Assert: passed on as it is, so the error handler answers 400, never 500 `hvl:duplicate-failed`
      expect(toErrorResponse(error, 'nn')).toMatchObject({
        status: 400,
        body: { errorCode: 'invalid-metadata' },
      });
      expect(await owned()).toBe(before);
    }, 60_000);
  });
});
