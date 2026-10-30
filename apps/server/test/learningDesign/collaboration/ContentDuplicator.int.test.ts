/**
 * Integration tests of ContentDuplicator.duplicate (D-092) on the real examples of the six types whose examples have
 * files: the copy holds the source's parameters, files and h5p.json, is a private draft of the person who copied,
 * keeps the source's attribution, is audited with IDs only, and leaves the source untouched. A stored name Lumi
 * will not copy is copied under a safe name.
 *
 * Spec: PROD-007, DATA-007
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import type { VideoParams } from './duplicateFilesBench.js';
import { openDuplicatorBench, type DuplicatorBench } from './duplicatorBench.js';

const TYPES = [
  'H5P.CoursePresentation',
  'H5P.InteractiveVideo',
  'H5P.ImageHotspots',
  'H5P.BranchingScenario',
  'H5P.Column',
  'H5P.InteractiveBook',
];
const H5P_JSON_FIELDS = [
  'title',
  'license',
  'authors',
  'defaultLanguage',
  'language',
  'mainLibrary',
] as const;

describeWithServices('[PROD-007] ContentDuplicator copies an activity', () => {
  describeWithRealPackages('[PROD-007] real content types', () => {
    let bench: DuplicatorBench;

    beforeAll(async () => {
      bench = await openDuplicatorBench();
    }, 180_000);
    afterAll(() => bench.close());

    it.each(TYPES)(
      '[PROD-007] a bank copy of the %s example holds its parameters, files and h5p.json',
      async (type) => {
        // Arrange: a published, bank-listed source of another author, as the editor stores it, with an h5p.json author
        const sourceId = await bench.importSaved(type, true);
        const authors = [{ name: 'Ola Testforfattar', role: 'Author' }];
        const sourceMeta = await bench.changeMetadata(sourceId, { authors });
        const [sourceParams, sourceFiles] = [await bench.paramsOf(sourceId), await bench.filesOf(sourceId)];
        // Act
        const { contentId, via } = await bench.duplicator.duplicate(sourceId, bench.copier.actor);
        // Assert: every reference names a file with the same bytes, and the copy stores nothing else
        expect(via).toBe('bank');
        expect(await bench.hashedParams(contentId)).toEqual(await bench.hashedParams(sourceId));
        expect(JSON.stringify(await bench.paramsOf(contentId))).not.toMatch(/\.\.\/|#tmp/);
        expect(await bench.referencedPathsOf(contentId)).toEqual(await bench.fileNames(contentId));
        const copyMeta = await bench.metadataOf(contentId);
        for (const field of H5P_JSON_FIELDS) expect(copyMeta[field]).toEqual(sourceMeta[field]);
        // Assert: the source is untouched
        expect(await bench.paramsOf(sourceId)).toEqual(sourceParams);
        expect(await bench.filesOf(sourceId)).toEqual(sourceFiles);
      },
      60_000,
    );

    it('[PROD-007] the copy is a private draft of the copier that keeps its source and the source’s author', async () => {
      // Arrange: a published, bank-listed source the copier may only View
      const sourceId = await bench.importExample('H5P.ImageHotspots', true);
      // Act
      const { contentId } = await bench.duplicator.duplicate(sourceId, bench.copier.actor);
      // Assert
      const copy = await bench.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
      expect(copy).toMatchObject({
        ownerUserId: bench.copier.actor.accountId,
        status: 'draft',
        visibility: 'private',
        bankListedAt: null,
        publishedAt: null,
        version: 1,
        sourceContentId: sourceId,
        sourceAuthorUserId: bench.owner.actor.accountId,
      });
      // PRIVACY: the actor is the only person in the audit event; the details are IDs and codes (DATA-007).
      expect(await bench.duplicatedEvents(contentId)).toEqual([
        {
          actorUserId: bench.copier.actor.accountId,
          details: { sourceContentId: sourceId, via: 'bank', kind: 'duplicate' },
        },
      ]);
    }, 60_000);

    it('[PROD-007] a stored file name Lumi will not copy is copied under a safe name', async () => {
      // Arrange: the source's video stored as `videos/klipp av hav æ.webm`, as an imported package may hold it
      const sourceId = await bench.importExample('H5P.InteractiveVideo', true);
      const unsafe = 'videos/klipp av hav æ.webm';
      await bench.storeAs(sourceId, 'videos/clip.webm', unsafe);
      const params = (await bench.paramsOf(sourceId)) as unknown as VideoParams;
      params.interactiveVideo.video.files = [{ path: unsafe, mime: 'video/webm' }];
      await bench.tb.db.h5PContent.update({ where: { id: sourceId }, data: { params: { ...params } } });
      // Act
      const { contentId } = await bench.duplicator.duplicate(sourceId, bench.copier.actor);
      // Assert: the copy's video has a safe name and the same bytes, and nothing points into the source
      const copy = (await bench.paramsOf(contentId)) as unknown as VideoParams;
      const [video] = copy.interactiveVideo.video.files;
      expect(video?.path).toMatch(/^videos\/klipp-av-hav-ae-[0-9A-Za-z]{8}\.webm$/);
      const sourceVideo = (await bench.filesOf(sourceId)).find((f) => f.filename === unsafe);
      const copyVideo = (await bench.filesOf(contentId)).find((f) => f.filename === video?.path);
      expect(copyVideo?.sha256).toBe(sourceVideo?.sha256);
      expect(JSON.stringify(copy)).not.toContain(sourceId);
    }, 60_000);
  });
});
