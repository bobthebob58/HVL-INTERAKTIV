/**
 * Integration tests of a changed answer key through the editor's save route on the real content types: the save
 * keeps every learner's state, asks nothing and starts a new content version, and insight then counts the answers
 * given before it under the version they were judged in (D-137).
 *
 * Spec: PROD-013, INS-003, INS-006
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaContentStorage } from '../../../src/h5p/storage/PrismaContentStorage.js';
import type { S3ContentFileStore } from '../../../src/h5p/storage/S3ContentFileStore.js';
import { InsightService } from '../../../src/insight/InsightService.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { shown } from '../../insight/support/insightFixtureReport.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import {
  edited,
  replaceText,
  type BlanksParams,
  type MultiChoiceParams,
} from './learnerStateAfterEditEdits.js';
import { openSafeEditingBench, type BenchActivity, type SafeEditingBench } from './safeEditingBench.js';

const NOW = new Date('2026-11-04T12:00:00.000Z');
const ANSWERED = Date.parse('2026-11-02T09:00:00.000Z');
/** The options seven learners chose first: five the option that is correct in the example, two the next one. */
const CHOSEN = [0, 0, 0, 0, 0, 1, 1];

describeWithServices('[PROD-013] a changed answer key through the save route', () => {
  describeWithRealPackages('[PROD-013] on the real content types', () => {
    let bench: SafeEditingBench;
    let insight: InsightService;
    beforeAll(async () => {
      bench = await openSafeEditingBench();
      insight = new InsightService({
        db: bench.tb.db,
        // WHY: only the parameters and metadata are read; the S3 file store is never touched here.
        content: new PrismaContentStorage(bench.tb.db, {} as S3ContentFileStore),
        groupSize: minimumGroupSize(5),
        clock: () => NOW,
      });
    }, 240_000);
    afterAll(() => bench?.close());

    /** Stores the seven learners' first answers to a single-question activity, judged as the example judges. */
    const storeFirstAnswers = (activity: BenchActivity, contentVersion: number) =>
      bench.tb.db.xapiStatement.createMany({
        data: CHOSEN.map((option, learner) => ({
          contentId: activity.id,
          contentVersion,
          contextId: null,
          academicYear: 2026,
          learnerKey: `answer-key-${activity.id}-${String(learner)}`,
          attemptId: `${randomUUID()}:1`,
          subContentId: null,
          verb: 'answered',
          scoreRaw: option === 0 ? 1 : 0,
          scoreMax: 1,
          success: option === 0,
          response: String(option),
          timestamp: new Date(ANSWERED + learner * 60_000),
        })),
      });
    const keyMoved = (activity: BenchActivity) =>
      edited<MultiChoiceParams>(activity.params, (p) => {
        [p.answers[0]!.correct, p.answers[1]!.correct] = [false, true];
      });

    it('[PROD-013] marking another option correct keeps every learner’s state and starts a new version', async () => {
      // Arrange
      const mc = await bench.importExample('H5P.MultiChoice');
      await bench.writeState(mc, 'author', '{"answers":[0]}');
      const other = await bench.addOtherLearnersState(mc);
      const before = await bench.stateKeys(mc.id);
      // Act: the save asks nothing, although someone else has state
      const res = await bench.save(mc, keyMoved(mc));
      const again = await bench.save(mc, keyMoved(mc));
      // Assert: one new version for the change, none for the same key saved again
      expect([res.status, again.status]).toEqual([200, 200]);
      expect(before).toContain(other);
      expect(await bench.stateKeys(mc.id)).toEqual(before);
      const stored = await bench.stored(mc.id);
      const marks = (stored.params as MultiChoiceParams).answers.map((answer) => answer.correct);
      expect({ marks: marks.slice(0, 2), version: stored.version }).toEqual({
        marks: [false, true],
        version: 2,
      });
    });

    it('[PROD-013] another accepted answer of a gap starts a new version; a reworded tip does not', async () => {
      // Arrange
      const blanks = await bench.importExample('H5P.Blanks');
      await bench.addOtherLearnersState(blanks);
      const tipReworded = edited<BlanksParams>(blanks.params, (p) => {
        p.questions[0] = replaceText(p.questions[0]!, 'Ei kort', 'Ei lita');
      });
      const otherAnswer = edited<BlanksParams>(tipReworded, (p) => {
        p.questions[0] = replaceText(p.questions[0]!, '*quiz/test:', '*prøve:');
      });
      // Act
      const first = await bench.save(blanks, tipReworded);
      const afterTip = (await bench.stored(blanks.id)).version;
      const second = await bench.save(blanks, otherAnswer);
      // Assert
      expect([first.status, second.status]).toEqual([200, 200]);
      expect([afterTip, (await bench.stored(blanks.id)).version]).toEqual([1, 2]);
      expect(await bench.stateKeys(blanks.id)).toHaveLength(1);
    });

    it('[INS-003] insight counts the answers given before the change under their own version only', async () => {
      // Arrange: seven first answers judged against the example's key, then the key is moved
      const mc = await bench.importExample('H5P.MultiChoice');
      await storeFirstAnswers(mc, 1);
      await bench.save(mc, keyMoved(mc));
      // Act
      const current = await insight.forActivity({ contentId: mc.id, context: 'portal' });
      const previous = await insight.forActivity({ contentId: mc.id, context: 'portal', version: 1 });
      // Assert: the new key's distribution holds none of them; the older version shows no distribution (D-106)
      const [distribution] = current.misconceptions;
      expect(current.scope).toMatchObject({ contentVersion: 2, currentVersion: 2 });
      expect(shown(current.participation.started)).toBe(0);
      expect(distribution).toMatchObject({ kind: 'choice', learners: { suppressed: false, value: 0 } });
      expect(shown(previous.participation.started)).toBe(7);
      expect(previous.items.map((item) => shown(item.firstCorrect))).toEqual([0.7143]);
      expect(previous.misconceptions).toEqual([]);
    });

    it('[PROD-013] a page rendered before the change no longer saves state, and one rendered after it does', async () => {
      // Arrange
      const mc = await bench.importExample('H5P.MultiChoice');
      await bench.save(mc, keyMoved(mc));
      // Act
      const old = await bench.writeState(mc, 'author', '{"answers":[1]}', '1');
      const fresh = await bench.writeState(mc, 'author', '{"answers":[1]}', '2');
      // Assert
      expect(old.body).toEqual({ success: false, message: 'hvl:learner-state-stale' });
      expect(fresh.body).toMatchObject({ success: true });
    });
  });
});
