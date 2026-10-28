/**
 * Probe P2 (D-092): how Lumi 10.0.4 copies another activity's files when a duplicate is saved through
 * HvlH5PEditor, on the real examples of the six types whose examples have files.
 *
 * Why: the ContentDuplicator rewrites each file path to Lumi's paste-source form `../<sourceId>/<file>` and saves
 *      the clone as a new activity. These tests pin what Lumi then does: the references it finds (nested ones too),
 *      how it renames and stores copies, how new uploads in the same save are stored (D-093's save as a copy), what
 *      it does, silently, when it cannot copy a file, and how a `#tmp` suffix on a paste path half-saves.
 * Spec: PROD-007
 * Invariants: every activity is owned by a bench author, so `bench.close()` removes its rows and the bucket.
 * Collaborators: ./duplicateFilesBench.ts, ./duplicateFilesPasteSource.ts, ../../support/realPackages.ts.
 */
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { UnsafeObjectNameError } from '../../../src/h5p/storage/s3Objects.js';
import { toErrorResponse } from '../../../src/http/h5pErrorResponse.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import {
  addPosterAndImageInteraction,
  openDuplicateBench,
  type DuplicateBench,
  type ImageParams,
  type VideoParams,
} from './duplicateFilesBench.js';
import { namePattern, pastedName } from './duplicateFilesPasteSource.js';

const EXAMPLES = [
  // WHY: the CP, Column and book-cover images are H5P.Image sub-content; the IV text track is a `file` field.
  ['H5P.CoursePresentation', ['images/diagram.png']],
  ['H5P.InteractiveVideo', ['videos/clip.nn.vtt', 'videos/clip.webm']],
  ['H5P.ImageHotspots', ['images/diagram.png']],
  ['H5P.BranchingScenario', ['images/diagram.png']],
  ['H5P.Column', ['images/diagram.png']],
  ['H5P.InteractiveBook', ['images/diagram.png']],
] as const;

describeWithServices('[PROD-007] a duplicate copies its files through the paste-source form', () => {
  describeWithRealPackages('[PROD-007] real content types', () => {
    let bench: DuplicateBench;

    beforeAll(async () => {
      bench = await openDuplicateBench();
    }, 180_000);
    afterAll(() => bench.close());

    it.each(EXAMPLES)(
      '[PROD-007] a duplicate of the %s example gets its own renamed copy of every referenced file',
      async (type, expected) => {
        // Arrange: a published source shared with all of HVL, which the copier may View but not Edit
        const sourceId = await bench.importExample(type, true);
        const { source, files, params, rewritten } = await bench.pasteFrom(sourceId);
        // Act
        const copyId = await bench.saveCopy(params, source);
        // Assert: Lumi's scan finds every file, nested ones too, and only referenced files are copied
        expect([...rewritten].sort()).toEqual(expected);
        const referenced = files.filter((f) => rewritten.includes(f.filename));
        const copyFiles = await bench.filesOf(copyId);
        expect(copyFiles.map((c) => c.sha256).sort()).toEqual(referenced.map((s) => s.sha256).sort());
        // WHY: the testbed's import (Lumi's Install mode) stores content.json as a file too; nothing refers to it.
        expect(files.map((f) => f.filename)).toContain('content.json');
        // Assert: each copy is renamed, stored under the copy's own key and referenced by a local path
        const matches = referenced.map((s) =>
          copyFiles.filter((c) => pastedName(s.filename).test(c.filename)),
        );
        expect(matches.map((m) => m.length)).toEqual(referenced.map(() => 1));
        expect(copyFiles.every((f) => f.s3Key.startsWith(`content/${copyId}/`))).toBe(true);
        expect(await bench.referencedPathsOf(copyId)).toEqual(copyFiles.map((f) => f.filename).sort());
        // Assert: the source is untouched, and the copies outlive it
        expect(await bench.filesOf(sourceId)).toEqual(files);
        expect(await bench.paramsOf(sourceId)).toEqual(source.params);
        await bench.deleteAsOwner(sourceId);
        for (const f of copyFiles) expect(await bench.readSha256(copyId, f.filename)).toBe(f.sha256);
      },
      60_000,
    );

    it('[PROD-007] a poster and an H5P.Image interaction pasted into a video from a slide deck each get a copy', async () => {
      // Arrange: the video's own files, plus two references to one file of another activity
      const slidesId = await bench.importExample('H5P.CoursePresentation', true);
      const videoId = await bench.importExample('H5P.InteractiveVideo', true);
      const { source, params } = await bench.pasteFrom(videoId);
      addPosterAndImageInteraction(params, `../${slidesId}/images/diagram.png`);
      // Act
      const copyId = await bench.saveCopy(params, source);
      // Assert: one copy per reference, under two names with the same bytes
      const copyFiles = await bench.filesOf(copyId);
      const diagrams = copyFiles.filter((f) => pastedName('images/diagram.png').test(f.filename));
      expect(copyFiles).toHaveLength(4);
      expect(new Set(diagrams.map((f) => f.filename)).size).toBe(2);
      expect(new Set(diagrams.map((f) => f.sha256)).size).toBe(1);
      const copy = (await bench.paramsOf(copyId)) as unknown as VideoParams;
      const { poster } = copy.interactiveVideo.video.startScreenOptions as { poster: { path: string } };
      expect(diagrams.map((f) => f.filename)).toContain(poster.path);
      expect(JSON.stringify(copy)).not.toContain('../');
    }, 60_000);

    it.each([
      ['diagram.png', 'diagram-ID.png', 'diagram-ID.png'],
      ['hvl-logo.png', 'hvl-ID.png', 'hvl-ID.png'],
      ['my-diagram-2.png', 'my-diagram-2-ID.png', 'my-diagram-2-ID-ID.png'],
    ])(
      '[PROD-007] a pasted copy of images/%s is named images/%s, and a copy of that copy images/%s',
      async (name, firstName, secondName) => {
        // Arrange: the source's image stored under `name`, and a first copy of it
        const sourceId = await bench.importExample('H5P.ImageHotspots', true);
        if (name !== 'diagram.png') await bench.storeAs(sourceId, 'images/diagram.png', `images/${name}`);
        const first = await bench.pasteFrom(sourceId);
        (first.params as unknown as ImageParams).image.path = `../${sourceId}/images/${name}`;
        const firstId = await bench.saveCopy(first.params, first.source);
        const second = await bench.pasteFrom(firstId);
        // Act
        const secondId = await bench.saveCopy(second.params, second.source);
        // Assert: FilenameGenerator drops a tail of its ID characters after the FIRST hyphen, else stacks a suffix
        expect(second.rewritten).toEqual([expect.stringMatching(namePattern(`images/${firstName}`))]);
        const names = await bench.fileNames(secondId);
        expect(names).toEqual([expect.stringMatching(namePattern(`images/${secondName}`))]);
      },
      60_000,
    );

    it('[PROD-007] new uploads (#tmp) saved with a copy are stored once each, beside the pasted files', async () => {
      // Arrange: D-093's save as a copy, with a new poster and image that are one upload of the copier's
      const videoId = await bench.importExample('H5P.InteractiveVideo', true);
      const { source, params } = await bench.pasteFrom(videoId);
      const upload = await bench.uploadTemporary('images/poster.png');
      addPosterAndImageInteraction(params, `${upload}#tmp`);
      // Act
      const copyId = await bench.saveCopy(params, source);
      // Assert: unlike a paste, both references share one stored file under the upload's own name
      const names = await bench.fileNames(copyId);
      expect(names).toHaveLength(3);
      expect(names).toContain(upload);
      expect(JSON.stringify(await bench.paramsOf(copyId))).not.toMatch(/#tmp|\.\.\//);
    }, 60_000);

    it('[PROD-007] without View on the source the save still succeeds: a draft copy with an emptied path and no file', async () => {
      // Arrange: a draft that only its owner may View
      const sourceId = await bench.importExample('H5P.ImageHotspots', false);
      const { source, files, params } = await bench.pasteFrom(sourceId);
      const reads = vi.spyOn(bench.tb.runtime.editor.contentManager, 'getContentFileStream');
      // Act
      const copyId = await bench.saveCopy(params, source);
      // Assert: Lumi asks for View, is refused, swallows the 403 (ContentStorer) and saves the rest
      expect(await bench.copierMayView(sourceId)).toBe(false);
      expect(reads).toHaveBeenCalledWith(sourceId, 'images/diagram.png', bench.copierUser);
      await expect(reads.mock.results[0]?.value).rejects.toMatchObject({
        errorId: 'h5p-server:content-missing-view-permission',
        httpStatusCode: 403,
      });
      reads.mockRestore();
      const copy = await bench.tb.db.h5PContent.findUniqueOrThrow({ where: { id: copyId } });
      expect(copy).toMatchObject({ ownerUserId: bench.copier.actor.accountId, status: 'draft' });
      expect((copy.params as unknown as ImageParams).image.path).toBe('');
      expect(await bench.filesOf(copyId)).toEqual([]);
      expect(await bench.filesOf(sourceId)).toEqual(files);
    }, 60_000);

    it.each([
      ['a file the source does not store', 'videos/missing.webm', 'video/webm', false, 'emptied'],
      ['a stored name outside Lumi’s pattern', 'videos/klipp av hav æ.webm', 'video/webm', true, 'kept'],
      ['a protocol-less video link', 'youtu.be/abc', 'video/YouTube', false, 'kept'],
    ] as const)(
      '[PROD-007] a paste reference to %s is not copied, and the save succeeds',
      async (_case, name, mime, stored, outcome) => {
        // Arrange
        const sourceId = await bench.importExample('H5P.InteractiveVideo', true);
        if (stored) await bench.storeAs(sourceId, 'videos/clip.webm', name);
        const { source, params } = await bench.pasteFrom(sourceId);
        const pasted = `../${sourceId}/${name}`;
        (params as unknown as VideoParams).interactiveVideo.video.files = [{ path: pasted, mime }];
        // Act
        const copyId = await bench.saveCopy(params, source);
        // Assert: only the text track is copied; the video path is emptied, or kept pointing into the source
        const copy = (await bench.paramsOf(copyId)) as unknown as VideoParams;
        expect(copy.interactiveVideo.video.files[0]?.path).toBe(outcome === 'emptied' ? '' : pasted);
        const names = await bench.fileNames(copyId);
        expect(names).toEqual([expect.stringMatching(pastedName('videos/clip.nn.vtt'))]);
      },
      60_000,
    );

    it('[PROD-007] a paste path with a #tmp suffix fails the save (400) after the activity row is written', async () => {
      // Arrange
      const sourceId = await bench.importExample('H5P.ImageHotspots', true);
      const { source, params } = await bench.pasteFrom(sourceId);
      (params as unknown as ImageParams).image.path = `../${sourceId}/images/diagram.png#tmp`;
      const before = await bench.copierActivityIds();
      // Act: Lumi looks for a temporary file "../<id>/…", which our temporary storage refuses
      const error = await bench.saveCopy(params, source).catch((e: unknown) => e);
      // Assert: a 400, not a 500; the row Lumi wrote first stays, holding the un-copied path and no files
      expect(error).toBeInstanceOf(UnsafeObjectNameError);
      expect(toErrorResponse(error, 'nn').status).toBe(400);
      const [orphanId = '', ...more] = (await bench.copierActivityIds()).filter((id) => !before.includes(id));
      expect(more).toEqual([]);
      const orphan = (await bench.paramsOf(orphanId)) as unknown as ImageParams;
      expect(orphan.image.path).toBe(`../${sourceId}/images/diagram.png`);
      expect(await bench.filesOf(orphanId)).toEqual([]);
    }, 60_000);
  });
});
