/**
 * Integration tests of when an insight view ends and which year it reads, on PostgreSQL (D-106's amendment of
 * 2026-11-04): a statement stored today never changes today's view, so two views minutes apart cannot show what one
 * learner did in between; it is in tomorrow's. A view never spans 1 August and reads only its year's rows, so a
 * learner under the old and the new year's key (the portal's 12-hour tail, D-057) counts once.
 *
 * Spec: INS-001, INS-006
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaContentStorage } from '../../src/h5p/storage/PrismaContentStorage.js';
import type { S3ContentFileStore } from '../../src/h5p/storage/S3ContentFileStore.js';
import { InsightService } from '../../src/insight/InsightService.js';
import { minimumGroupSize } from '../../src/privacy/minimumGroupSize.js';
import { describeWithServices } from '../support/services.js';
import { FIXTURE_NOW } from './fixtures/thirtyLearners.js';
import { openInsightDbFixture, type InsightDbFixture } from './support/insightDbFixture.js';
import { shown } from './support/insightFixtureReport.js';

const HOUR = 3_600_000;

describeWithServices(
  '[INS-006] a view ends at the latest midnight in Oslo and stays in one academic year',
  () => {
    let fx: InsightDbFixture;
    let now = FIXTURE_NOW;
    let insight: InsightService;
    beforeAll(async () => {
      fx = await openInsightDbFixture();
      insight = new InsightService({
        db: fx.db,
        // WHY: only the parameters and metadata are read; the S3 file store is never touched here.
        content: new PrismaContentStorage(fx.db, {} as S3ContentFileStore),
        groupSize: minimumGroupSize(5),
        clock: () => now,
      });
    });
    afterAll(() => fx.close());

    /** A root `attempted` of a new page load: enough to count as started (INS-001). */
    const started = (learnerKey: string, at: Date, academicYear: number, contextId: string | null) => ({
      id: randomUUID(),
      contentId: fx.questionSetId,
      contentVersion: 2,
      contextId,
      learnerKey,
      verb: 'attempted',
      attemptId: `${randomUUID()}:1`,
      timestamp: at,
      academicYear,
    });
    const view = (context: string, period: '7d' | '30d') =>
      insight.forActivity({ contentId: fx.questionSetId, context, period });

    it('[INS-006] a statement stored today never changes today’s view, and is in tomorrow’s', async () => {
      // Arrange: the fixture's view at 13:00 on 4 November 2026 (Oslo); six new learners play at 09:00 that day
      now = FIXTURE_NOW;
      const before = await view(fx.courseA, '30d');
      const today = new Date('2026-11-04T08:00:00.000Z');
      await fx.db.xapiStatement.createMany({
        data: Array.from({ length: 6 }, (_, i) => started(`today-${String(i)}`, today, 2026, fx.courseA)),
      });
      // Act: again at once, at 23:59 the same day, and at 00:30 the next day
      const again = await view(fx.courseA, '30d');
      now = new Date('2026-11-04T22:59:00.000Z');
      const lateToday = await view(fx.courseA, '30d');
      now = new Date('2026-11-04T23:30:00.000Z');
      const tomorrow = await view(fx.courseA, '30d');
      // Assert
      expect(before.scope.periodEnd).toBe('2026-11-03T23:00:00.000Z');
      expect(again).toEqual(before);
      expect(lateToday).toEqual(before);
      expect(shown(before.participation.started)).toBe(30);
      expect(shown(tomorrow.participation.started)).toBe(36);
    });

    it('[INS-006] from 2 August a view starts on 1 August and reads only the new year’s keys, so nobody counts twice', async () => {
      // Arrange: portal plays around 1 August 2027 (CEST). Five learners in late July under the 2026 keys. On
      // 1 August, one learner under their old key at 05:00 (a session made before midnight, D-057) and under their
      // new key at 14:00. Five more learners under 2027 keys on 2 August.
      const at = (iso: string) => new Date(iso);
      await fx.db.xapiStatement.createMany({
        data: [
          ...Array.from({ length: 5 }, (_, i) =>
            started(`july-${String(i)}`, at('2027-07-30T10:00:00Z'), 2026, null),
          ),
          started('tail-old-key', at('2027-08-01T03:00:00Z'), 2026, null),
          started('tail-new-key', at('2027-08-01T12:00:00Z'), 2027, null),
          ...Array.from({ length: 5 }, (_, i) =>
            started(`august-${String(i)}`, at('2027-08-02T10:00:00Z'), 2027, null),
          ),
        ],
      });
      // Act: the 7-day view at noon on 5 August 2027, and on 1 August, when the period still ends at 31 July
      now = at('2027-08-05T10:00:00Z');
      const august = await view('portal', '7d');
      now = new Date(at('2027-08-01T10:00:00Z').getTime() + HOUR);
      const firstOfAugust = await view('portal', '7d');
      // Assert: 5 August counts the tail learner once (new key) and nobody from July
      expect(august.scope).toMatchObject({
        periodStart: '2027-07-31T22:00:00.000Z',
        periodEnd: '2027-08-04T22:00:00.000Z',
      });
      expect(shown(august.participation.started)).toBe(6);
      // Assert: on 1 August the view is the last 7 days of July, under the 2026 keys only
      expect(firstOfAugust.scope.periodEnd).toBe('2027-07-31T22:00:00.000Z');
      expect(shown(firstOfAugust.participation.started)).toBe(5);
    });
  },
);
