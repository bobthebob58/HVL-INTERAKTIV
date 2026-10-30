/**
 * Integration tests of the editor's paste-source guard (D-092 amendment) on the real content types: a save whose
 * file paths copy from an activity the saver may not duplicate (nested sub-content and updates included), or name a
 * file the storage would refuse, is refused before Lumi writes anything; an author's paste from their own activity
 * still copies the files.
 *
 * Spec: PROD-007, SEC-008, H5P-006
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { H5pError } from '@lumieducation/h5p-server';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { toErrorResponse } from '../../src/http/h5pErrorResponse.js';
import { t, type Locale } from '../../src/i18n/translate.js';
import {
  addPosterAndImageInteraction,
  openDuplicateBench,
  type DuplicateBench,
  type ImageParams,
  type VideoParams,
} from '../learningDesign/collaboration/duplicateFilesBench.js';
import { pastedName } from '../learningDesign/collaboration/duplicateFilesPasteSource.js';
import { describeWithRealPackages } from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

const LOCALES: Locale[] = ['nn', 'nb', 'en'];

describeWithServices('[PROD-007] the editor refuses paste paths before Lumi writes', () => {
  describeWithRealPackages('[PROD-007] real content types', () => {
    let bench: DuplicateBench;

    beforeAll(async () => {
      bench = await openDuplicateBench();
    }, 180_000);
    afterAll(() => bench.close());

    /** Saves ImageHotspots parameters whose image path is `path`, as the copier; returns the refusal and new rows. */
    async function saveImagePath(sourceId: string, path: (id: string) => string) {
      const { source, params } = await bench.pasteFrom(sourceId);
      (params as unknown as ImageParams).image.path = path(sourceId);
      const before = await bench.copierActivityIds();
      const error = await bench.saveCopy(params, source).catch((e: unknown) => e);
      const after = await bench.copierActivityIds();
      return { error, newRows: after.filter((id) => !before.includes(id)) };
    }

    describe('[PROD-007] sources the saver may not duplicate', () => {
      it.each([
        ['a draft the saver may not view', false, true],
        ['an activity shared with HVL but not in the bank', true, false],
      ])(
        '[PROD-007] a paste from %s is refused (403) and writes nothing',
        async (_name, published, listed) => {
          // Arrange
          const sourceId = await bench.importExample('H5P.ImageHotspots', published);
          if (!listed)
            await bench.tb.db.h5PContent.update({ where: { id: sourceId }, data: { bankListedAt: null } });
          const reads = vi.spyOn(bench.tb.runtime.editor.contentManager, 'getContentFileStream');
          // Act
          const { error, newRows } = await saveImagePath(sourceId, (id) => `../${id}/images/diagram.png`);
          // Assert: our refusal, before Lumi asked for the file or wrote a row
          expect(error).toBeInstanceOf(H5pError);
          expect(error).toMatchObject({ errorId: 'hvl:paste-source-not-allowed', httpStatusCode: 403 });
          expect(reads).not.toHaveBeenCalled();
          reads.mockRestore();
          expect(newRows).toEqual([]);
        },
        60_000,
      );

      it('[PROD-007] a paste from an unknown activity gets the same 403, so it reveals nothing', async () => {
        const sourceId = await bench.importExample('H5P.ImageHotspots', true); // Arrange
        const unknown = '0192f0c4-0000-7000-8000-0000000000ff';
        const { error, newRows } = await saveImagePath(sourceId, () => `../${unknown}/images/x.png`); // Act
        expect(error).toMatchObject({ errorId: 'hvl:paste-source-not-allowed', httpStatusCode: 403 }); // Assert
        expect(newRows).toEqual([]);
      }, 60_000);

      it('[PROD-007] a paste path inside nested sub-content is found and refused (403)', async () => {
        // Arrange: a copy of a bank video whose H5P.Image interaction pastes from an activity not in the bank
        const unlisted = await bench.importExample('H5P.ImageHotspots', true);
        await bench.tb.db.h5PContent.update({ where: { id: unlisted }, data: { bankListedAt: null } });
        const { source, params } = await bench.pasteFrom(
          await bench.importExample('H5P.InteractiveVideo', true),
        );
        addPosterAndImageInteraction(params, `../${unlisted}/images/diagram.png`);
        const { video } = (params as unknown as VideoParams).interactiveVideo;
        video.startScreenOptions = { ...video.startScreenOptions, poster: undefined };
        const before = await bench.copierActivityIds();
        // Act
        const error = await bench.saveCopy(params, source).catch((e: unknown) => e);
        // Assert
        expect(error).toMatchObject({ errorId: 'hvl:paste-source-not-allowed', httpStatusCode: 403 });
        expect((await bench.copierActivityIds()).filter((id) => !before.includes(id))).toEqual([]);
      }, 60_000);

      it('[PROD-007] an update with such a paste path is refused and leaves the saved activity as it was', async () => {
        // Arrange: the copier's own saved activity, and a colleague's activity that is not in the bank
        const unlisted = await bench.importExample('H5P.ImageHotspots', true);
        await bench.tb.db.h5PContent.update({ where: { id: unlisted }, data: { bankListedAt: null } });
        const { source, params } = await bench.pasteFrom(
          await bench.importExample('H5P.ImageHotspots', true),
        );
        const ownId = await bench.saveCopy(params, source);
        const [stored, storedFiles] = [await bench.paramsOf(ownId), await bench.filesOf(ownId)];
        const edited = structuredClone(stored) as unknown as ImageParams;
        edited.image.path = `../${unlisted}/images/diagram.png`;
        const { editor } = bench.tb.runtime;
        // Act
        const error = await editor
          .saveOrUpdateContent(ownId, { ...edited }, source.metadata, source.ubername, bench.copierUser)
          .catch((e: unknown) => e);
        // Assert
        expect(error).toMatchObject({ errorId: 'hvl:paste-source-not-allowed', httpStatusCode: 403 });
        expect(await bench.paramsOf(ownId)).toEqual(stored);
        expect(await bench.filesOf(ownId)).toEqual(storedFiles);
      }, 60_000);

      it.each(LOCALES)('[PROD-007] the 403 is answered with the translated message in %s', (locale) => {
        const { status, body } = toErrorResponse(
          new H5pError('hvl:paste-source-not-allowed', {}, 403),
          locale,
        );
        expect({ status, code: body.errorCode }).toEqual({
          status: 403,
          code: 'hvl:paste-source-not-allowed',
        });
        expect(body.message).toBe(t('h5p.pasteSourceNotAllowed', {}, locale));
      });
    });

    describe('[SEC-008] paths the storage would refuse', () => {
      it.each([
        ['a paste path with a #tmp suffix', (id: string) => `../${id}/images/diagram.png#tmp`],
        [
          'a paste path whose stored name is outside Lumi’s pattern',
          (id: string) => `../${id}/images/kart av hav.png`,
        ],
        ['a paste path with .. in its file part', (id: string) => `../${id}/images/../../x.png`],
        ['a paste path whose source is not an ID', () => '../../images/diagram.png'],
        ['a leading slash', () => '/images/diagram.png'],
        ['a backslash', () => 'images\\diagram.png'],
        ['a . segment', () => 'images/./diagram.png'],
        ['an empty segment', () => 'images//diagram.png'],
        ['a #tmp upload with a .. segment', () => 'images/../diagram.png#tmp'],
      ])(
        '[SEC-008] %s is refused (400) and no row is written',
        async (_name, path) => {
          // Arrange
          const sourceId = await bench.importExample('H5P.ImageHotspots', true);
          // Act
          const { error, newRows } = await saveImagePath(sourceId, path);
          // Assert
          expect(error).toMatchObject({ errorId: 'hvl:unsafe-file-name', httpStatusCode: 400 });
          expect(newRows).toEqual([]);
          expect(toErrorResponse(error, 'nn').body.message).toBe(t('h5p.unsafeFileName', {}, 'nn'));
        },
        60_000,
      );

      it('[SEC-008] a web address with a capital in its scheme is saved as before, not refused', async () => {
        // Arrange: Lumi's scanner skips only `https://`, but H5P plays `Https://` (a tablet keyboard's) as a URL
        const sourceId = await bench.importExample('H5P.ImageHotspots', true);
        const url = 'Https://www.hvl.no/bilete.png';
        // Act
        const { error: copyId, newRows } = await saveImagePath(sourceId, () => url);
        // Assert
        expect(newRows).toEqual([copyId]);
        const saved = (await bench.paramsOf(String(copyId))) as unknown as ImageParams;
        expect(saved.image.path).toBe(url);
      }, 60_000);
    });

    it('[PROD-007] an author’s paste from their own draft copies the file', async () => {
      // Arrange: the owner pastes from an activity only they may see
      const sourceId = await bench.importExample('H5P.ImageHotspots', false);
      const { source, params } = await bench.pasteFrom(sourceId);
      const owner = asAccountUser(bench.owner.actor);
      // Act
      const copyId = await bench.tb.runtime.editor.saveOrUpdateContent(
        undefined,
        params,
        source.metadata,
        source.ubername,
        owner,
      );
      // Assert
      const [file] = await bench.filesOf(copyId);
      expect(file?.filename).toMatch(pastedName('images/diagram.png'));
      expect((await bench.paramsOf(copyId)) as unknown as ImageParams).toMatchObject({
        image: { path: file?.filename },
      });
    }, 60_000);
  });
});
