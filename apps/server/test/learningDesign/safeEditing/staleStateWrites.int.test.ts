/**
 * Integration tests for learner-state writes from pages opened before a structural save: the portal and Canvas
 * player pages send the activity's version, a write for an older version is dropped without an error the player
 * would show, and a write for the current version is stored (D-093).
 *
 * Spec: PROD-013, H5P-005
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { integrationFromPage } from '../../support/playerIntegration.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { edited, type MultiChoiceParams } from './learnerStateAfterEditEdits.js';
import { openSafeEditingBench, type BenchActivity, type SafeEditingBench } from './safeEditingBench.js';

type Integration = { ajax: { contentUserData: string } };
const STALE = { success: false, message: 'hvl:learner-state-stale' };

describeWithServices('[PROD-013] learner-state writes and the activity version', () => {
  describeWithRealPackages('[PROD-013] on a real published activity', () => {
    let bench: SafeEditingBench;
    beforeAll(async () => {
      bench = await openSafeEditingBench();
    }, 240_000);
    afterAll(() => bench?.close());

    const stateUrlOf = (html: string) => integrationFromPage<Integration>(html)?.ajax.contentUserData ?? '';
    const appendOption = (mc: BenchActivity) =>
      bench.save(
        mc,
        edited<MultiChoiceParams>(
          mc.params,
          (p) => void p.answers.push({ text: '<div>Ny</div>', correct: false }),
        ),
        {
          confirmLearnerStateReset: true,
        },
      );

    it('[PROD-013] the portal and the Canvas player pages carry the activity’s version in their state URL', async () => {
      // Arrange
      const mc = await bench.importExample('H5P.MultiChoice', { published: true });
      const ltik = await bench.launch(mc, 'student');
      const pages = async () => [
        stateUrlOf(
          (await request(bench.tb.app).get(`/h5p/play/${mc.id}`).set('Cookie', bench.author.cookie)).text,
        ),
        stateUrlOf((await request(bench.tb.app).get(`/lti/play?ltik=${encodeURIComponent(ltik)}`)).text),
      ];
      // Act
      const before = await pages();
      expect((await appendOption(mc)).status).toBe(200);
      const after = await pages();
      // Assert
      expect(
        before.map((url) => new URL(url, 'http://tool.invalid').searchParams.get('contentVersion')),
      ).toEqual(['1', '1']);
      expect(
        after.map((url) => new URL(url, 'http://tool.invalid').searchParams.get('contentVersion')),
      ).toEqual(['2', '2']);
      expect(after[0]).toContain('csrf=');
      expect(after[1]).toContain('ltik=');
    });

    it('[PROD-013] after a structural save a write from an older page is dropped, and a current one is stored', async () => {
      // Arrange: a Canvas learner's state, written while the activity has version 1
      const mc = await bench.importExample('H5P.MultiChoice', { published: true });
      const learner = { ltik: await bench.launch(mc, 'student') };
      const first = await bench.writeState(mc, learner, '{"answers":[1]}', '1');
      expect(first.body).toEqual({ success: true });
      expect((await appendOption(mc)).status).toBe(200);
      // Act
      const stale = await bench.writeState(mc, learner, '{"answers":[1]}', '1');
      const keysAfterStale = await bench.stateKeys(mc.id);
      const current = await bench.writeState(mc, learner, '{"answers":[3]}', '2');
      // Assert
      expect({ status: stale.status, body: stale.body, keys: keysAfterStale }).toEqual({
        status: 200,
        body: STALE,
        keys: [],
      });
      expect(current.body).toEqual({ success: true });
      const rows = await bench.tb.db.h5PUserData.findMany({
        where: { contentId: mc.id },
        select: { data: true },
      });
      expect(rows).toEqual([{ data: '{"answers":[3]}' }]);
    });

    it('[PROD-013] a text-only save keeps the version, so an open page goes on saving', async () => {
      // Arrange
      const mc = await bench.importExample('H5P.MultiChoice', { published: true });
      const learner = { ltik: await bench.launch(mc, 'student') };
      await bench.writeState(mc, learner, '{"answers":[1]}', '1');
      // Act
      const res = await bench.save(mc, {
        ...mc.params,
        question: '<p>Kva er typisk for undervegsvurdering?</p>',
      });
      const next = await bench.writeState(mc, learner, '{"answers":[2]}', '1');
      // Assert
      expect(res.status).toBe(200);
      expect(next.body).toEqual({ success: true });
      expect((await bench.stored(mc.id)).version).toBe(1);
    });

    it.each([['0'], ['abc'], ['1&contentVersion=2']])(
      '[PROD-013] a write with contentVersion=%s is refused with 400 and stores nothing',
      async (version) => {
        const mc = await bench.importExample('H5P.MultiChoice');
        const res = await bench.writeState(mc, 'author', '{"answers":[1]}', version);
        expect(res.status).toBe(400);
        expect(await bench.stateKeys(mc.id)).toEqual([]);
      },
    );
  });
});
