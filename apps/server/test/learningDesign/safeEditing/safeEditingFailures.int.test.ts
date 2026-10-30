/**
 * Integration tests of a structural save that fails part-way, through the editor's save route on a real MultiChoice
 * (D-093 amendment 2026-10-29, S5 review): the learner-state reset commits in the same transaction as Lumi's first
 * parameter write, so a reset the database refuses changes nothing (and the retry resets), and a failure after that
 * write (a file copy, say) leaves the new structure together with its reset, never with the old state.
 *
 * Spec: PROD-013
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { edited, type MultiChoiceParams } from './learnerStateAfterEditEdits.js';
import { openSafeEditingBench, type BenchActivity, type SafeEditingBench } from './safeEditingBench.js';

/** Makes PostgreSQL refuse to delete the activity's state rows until `lift` (a trigger that raises). */
async function refuseStateDeletes(bench: SafeEditingBench, contentId: string) {
  const db = bench.tb.db;
  await db.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION hvli_test_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated: connection lost'; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER hvli_test_refuse BEFORE DELETE ON "H5PUserData" FOR EACH ROW WHEN (OLD."contentId" = '${contentId}'::uuid) EXECUTE FUNCTION hvli_test_refuse()`,
  );
  return {
    lift: async () => {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS hvli_test_refuse ON "H5PUserData"');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS hvli_test_refuse()');
    },
  };
}

describeWithServices('[PROD-013] a structural save that fails part-way', () => {
  describeWithRealPackages('[PROD-013] on a real MultiChoice', () => {
    let bench: SafeEditingBench;
    beforeAll(async () => {
      bench = await openSafeEditingBench();
    }, 240_000);
    afterAll(() => bench?.close());

    const appendOption = (mc: BenchActivity) =>
      edited<MultiChoiceParams>(
        mc.params,
        (p) => void p.answers.push({ text: '<div>Ny</div>', correct: false }),
      );

    it('[PROD-013] a reset that fails in the database changes nothing, and the retry resets', async () => {
      // Arrange: the database refuses to delete this activity's state rows (a dropped connection, say)
      const mc = await bench.importExample('H5P.MultiChoice');
      const other = await bench.addOtherLearnersState(mc);
      const before = await bench.stored(mc.id);
      const refusal = await refuseStateDeletes(bench, mc.id);
      // Act
      const failed = await bench
        .save(mc, appendOption(mc), { confirmLearnerStateReset: true })
        .then(async (res) => ({
          res,
          stored: await bench.stored(mc.id),
          state: await bench.stateKeys(mc.id),
        }))
        .finally(() => refusal.lift());
      const retried = await bench.save(mc, appendOption(mc), { confirmLearnerStateReset: true });
      // Assert
      expect(failed).toMatchObject({ res: { status: 500 }, stored: before, state: [other] });
      expect(retried.status).toBe(200);
      expect({ version: (await bench.stored(mc.id)).version, state: await bench.stateKeys(mc.id) }).toEqual({
        version: 2,
        state: [],
      });
    });

    it('[PROD-013] a failure after Lumi’s first write keeps the new structure together with its reset', async () => {
      // Arrange: Lumi fails after it wrote the parameters, as when a file copy from temporary storage fails
      const mc = await bench.importExample('H5P.MultiChoice');
      await bench.addOtherLearnersState(mc);
      const manager = bench.tb.runtime.editor.contentManager;
      const write = manager.createOrUpdateContent.bind(manager);
      manager.createOrUpdateContent = async (...args) => {
        await write(...args);
        throw new Error('simulated: the file copy failed');
      };
      // Act
      const res = await Promise.resolve(
        bench.save(mc, appendOption(mc), { confirmLearnerStateReset: true }),
      ).finally(() => void (manager.createOrUpdateContent = write));
      // Assert
      const stored = await bench.stored(mc.id);
      expect(res.status).toBe(500);
      expect({
        options: (stored.params as MultiChoiceParams).answers.length,
        version: stored.version,
        state: await bench.stateKeys(mc.id),
      }).toEqual({ options: appendOption(mc).answers.length, version: 2, state: [] });
    });
  });
});
