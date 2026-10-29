/**
 * Integration tests for safe editing through the editor's save route on the real content types: a text-only save
 * keeps learner state, a structural save asks first while others have state and resets it once confirmed, the
 * saver's own state never asks, and the publish gate still runs first (D-093, D-074). A failed reset:
 * ./safeEditingFailures.int.test.ts.
 *
 * Spec: PROD-013, PROD-003
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { edited, type ColumnParams, type MultiChoiceParams } from './learnerStateAfterEditEdits.js';
import { openSafeEditingBench, type BenchActivity, type SafeEditingBench } from './safeEditingBench.js';

const fileNames = async (bench: SafeEditingBench, id: string) =>
  (await bench.tb.db.h5PContentFile.findMany({ where: { contentId: id }, select: { filename: true } }))
    .map((file) => file.filename)
    .sort();

describeWithServices('[PROD-013] safe editing through the save route', () => {
  describeWithRealPackages('[PROD-013] on the real content types', () => {
    let bench: SafeEditingBench;
    beforeAll(async () => {
      bench = await openSafeEditingBench();
    }, 240_000);
    afterAll(() => bench?.close());

    const ownKey = async (activity: BenchActivity) => {
      await bench.writeState(activity, 'author', '{"answers":[0]}');
      const keys = await bench.stateKeys(activity.id);
      if (keys.length !== 1) throw new Error('the author’s own state was not stored');
      return keys[0]!;
    };

    it('[PROD-013] a text-only save keeps every learner’s state and the version', async () => {
      // Arrange
      const mc = await bench.importExample('H5P.MultiChoice');
      const own = await ownKey(mc);
      const other = await bench.addOtherLearnersState(mc);
      const reworded = edited<MultiChoiceParams>(mc.params, (p) => {
        p.question = '<p>Kva er typisk for undervegsvurdering?</p>';
        p.answers[1]!.text = '<div>Ho tel med i karakteren i emnet.</div>';
      });
      // Act
      const res = await bench.save(mc, reworded);
      // Assert
      expect(res.status).toBe(200);
      expect(await bench.stateKeys(mc.id)).toEqual([own, other].sort());
      expect(await bench.stored(mc.id)).toMatchObject({
        params: { question: reworded.question },
        version: 1,
      });
    });

    it('[PROD-013] a structural save while another learner has state is 409 and changes no parameter, file or state', async () => {
      // Arrange: removing the Column's image is structural and would also delete the image file
      const column = await bench.importExample('H5P.Column');
      const other = await bench.addOtherLearnersState(column);
      const before = { stored: await bench.stored(column.id), files: await fileNames(bench, column.id) };
      const withoutImage = edited<ColumnParams>(column.params, (p) => void p.content.splice(1, 1));
      // Act
      const res = await bench.save(column, withoutImage);
      // Assert
      expect(res.status).toBe(409);
      expect(Object.keys(res.body as object).sort()).toEqual([
        'errorCode',
        'httpStatusCode',
        'message',
        'success',
      ]);
      expect(res.body).toMatchObject({ errorCode: 'hvl:learner-state-reset-needed', success: false });
      expect(String((res.body as { message: string }).message)).not.toMatch(/\d/);
      expect(await bench.stored(column.id)).toEqual(before.stored);
      expect(await fileNames(bench, column.id)).toEqual(before.files);
      expect(await bench.stateKeys(column.id)).toEqual([other]);
    });

    it('[PROD-013] the confirmed retry saves, deletes all learner state and raises the version', async () => {
      // Arrange
      const column = await bench.importExample('H5P.Column');
      await ownKey(column);
      await bench.addOtherLearnersState(column);
      const withoutImage = edited<ColumnParams>(column.params, (p) => void p.content.splice(1, 1));
      expect((await bench.save(column, withoutImage)).status).toBe(409);
      const images = (await fileNames(bench, column.id)).filter((name) => name.startsWith('images/'));
      expect(images).not.toEqual([]);
      // Act
      const res = await bench.save(column, withoutImage, { confirmLearnerStateReset: true });
      // Assert
      expect(res.status).toBe(200);
      const stored = await bench.stored(column.id);
      expect({ version: stored.version, items: (stored.params as ColumnParams).content.length }).toEqual({
        version: 2,
        items: 2,
      });
      expect(await bench.stateKeys(column.id)).toEqual([]);
      expect((await fileNames(bench, column.id)).filter((name) => images.includes(name))).toEqual([]);
    });

    it('[PROD-013] the saver’s own state never asks, and a structural save deletes it', async () => {
      // Arrange
      const mc = await bench.importExample('H5P.MultiChoice');
      await ownKey(mc);
      const appended = edited<MultiChoiceParams>(
        mc.params,
        (p) => void p.answers.push({ text: '<div>Ny</div>', correct: false }),
      );
      // Act
      const res = await bench.save(mc, appended);
      // Assert
      expect(res.status).toBe(200);
      expect(await bench.stateKeys(mc.id)).toEqual([]);
      expect((await bench.stored(mc.id)).version).toBe(2);
    });

    it('[PROD-003] the publish gate still runs first: an uncovered error blocks the save even when the reset is confirmed', async () => {
      // Arrange: a published image map whose alt text the sanitiser empties, with a hotspot removed (structural)
      const map = await bench.importExample('H5P.ImageHotspots', { published: true });
      const other = await bench.addOtherLearnersState(map);
      const before = await bench.stored(map.id);
      const broken = edited<{ backgroundImageAltText: string; hotspots: unknown[] }>(map.params, (p) => {
        p.backgroundImageAltText = '<style>Kart over campus</style>';
        p.hotspots.pop();
      });
      // Act
      const res = await bench.save(map, broken, { confirmLearnerStateReset: true });
      // Assert
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ errorCode: 'hvl:published-save-blocked' });
      expect(await bench.stored(map.id)).toEqual(before);
      expect(await bench.stateKeys(map.id)).toEqual([other]);
    });

    it('[PROD-013] a save body whose confirmLearnerStateReset is not a boolean is refused with 400', async () => {
      const mc = await bench.importExample('H5P.MultiChoice');
      const res = await bench.save(mc, mc.params, { confirmLearnerStateReset: 'yes' });
      expect(res.status).toBe(400);
    });
  });
});
