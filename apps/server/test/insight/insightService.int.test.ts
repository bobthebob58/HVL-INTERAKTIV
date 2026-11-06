/**
 * Integration tests of the insight facade on PostgreSQL: the 30-learner fixture's hand-calculated numbers through the
 * real query and content store, one version (PROD-013), one context (D-103) and one period at a time (D-106), the
 * activity's contexts, and the scope errors.
 *
 * Spec: INS-001, INS-002, INS-005, INS-006, INS-007, PROD-013
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaContentStorage } from '../../src/h5p/storage/PrismaContentStorage.js';
import type { S3ContentFileStore } from '../../src/h5p/storage/S3ContentFileStore.js';
import { InsightService } from '../../src/insight/InsightService.js';
import { InsightScopeError } from '../../src/insight/scope/insightScope.js';
import { minimumGroupSize } from '../../src/privacy/minimumGroupSize.js';
import { describeWithServices } from '../support/services.js';
import { IV1, Q1, Q2, Q3 } from './fixtures/insightActivities.js';
import { FIXTURE_NOW } from './fixtures/thirtyLearners.js';
import { openInsightDbFixture, type InsightDbFixture } from './support/insightDbFixture.js';
import { shown } from './support/insightFixtureReport.js';
import { insightInvariantViolations } from './support/reportInvariants.js';

describeWithServices('[INS-001] insight through PostgreSQL', () => {
  let fx: InsightDbFixture;
  let insight: InsightService;
  beforeAll(async () => {
    fx = await openInsightDbFixture();
    insight = new InsightService({
      db: fx.db,
      // WHY: only the parameters and metadata are read; the S3 file store is never touched here.
      content: new PrismaContentStorage(fx.db, {} as S3ContentFileStore),
      learnerCounts: {
        read: (key) =>
          Promise.resolve(key === fx.courseA ? { count: 40, countedAt: FIXTURE_NOW } : undefined),
      },
      groupSize: minimumGroupSize(5),
      clock: () => FIXTURE_NOW,
    });
  });
  afterAll(() => fx.close());

  it('[INS-001] numbers match the hand-calculated 30-learner fixture through the database', async () => {
    // Act
    const report = await insight.forActivity({ contentId: fx.questionSetId, context: fx.courseA });
    // Assert
    const p = report.participation;
    expect(
      [
        p.started,
        p.completed,
        p.completionRate,
        p.courseLearners,
        p.medianMinutesOnTask,
        p.medianAttempts,
      ].map((c) => shown(c)),
    ).toEqual([28, 23, 0.575, 40, 11, 1]);
    expect(report.scope).toMatchObject({
      contentVersion: 2,
      currentVersion: 2,
      period: '7d',
      periodStart: '2026-10-27T23:00:00.000Z',
      context: { key: fx.courseA, label: 'PED101' },
      k: 5,
    });
    expect(insightInvariantViolations(report)).toEqual([]);
    expect(JSON.stringify(report)).not.toContain('fixture-learner');
  });

  it('[INS-002] numbers match the fixture through the database, so the period and order are the query’s', async () => {
    // Act
    const report = await insight.forActivity({
      contentId: fx.questionSetId,
      context: fx.courseA,
      period: '7d',
    });
    // Assert
    expect(
      report.items.map((item) => [
        item.item,
        shown(item.learners),
        shown(item.firstCorrect),
        shown(item.latestCorrect),
      ]),
    ).toEqual([
      [Q1, 26, 0.4615, 0.7692],
      [Q3, 23, 0.5217, 0.8696],
      [Q2, 26, 0.5769, 0.8846],
    ]);
  });

  it('[INS-006] widens to 14 days only from an Oslo midnight: the learners before 28 October now count', async () => {
    // Act and assert: 14 days start on 21 October (CEST); 30 days also take in group F of 20 October.
    const report = await insight.forActivity({
      contentId: fx.questionSetId,
      context: fx.courseA,
      period: '14d',
    });
    expect(report.scope.periodStart).toBe('2026-10-20T22:00:00.000Z');
    expect(shown(report.participation.started)).toBe(28);
    const month = await insight.forActivity({
      contentId: fx.questionSetId,
      context: fx.courseA,
      period: '30d',
    });
    expect(shown(month.participation.started)).toBe(30);
  });

  it('[PROD-013] shows one version at a time: version 1 holds one learner, so it is suppressed', async () => {
    const report = await insight.forActivity({
      contentId: fx.questionSetId,
      context: fx.courseA,
      version: 1,
    });
    expect(report.scope.contentVersion).toBe(1);
    expect(shown(report.participation.started)).toBe('<k');
    expect(report.items.every((item) => shown(item.learners) === '<k' || shown(item.learners) === 0)).toBe(
      true,
    );
  });

  it('[INS-007] shows one context at a time: course B and the portal each hold one learner', async () => {
    for (const context of [fx.courseB, 'portal']) {
      const report = await insight.forActivity({ contentId: fx.questionSetId, context });
      expect(shown(report.participation.started)).toBe('<k');
      // WHY: neither has an NRPS count (course B has none stored; the portal never has one).
      expect(report.participation.completionBase).toBe('started');
    }
  });

  it('[PROD-013] refuses a version after the current one, and an activity that does not exist', async () => {
    // Act and assert: each refusal names its reason (the API answers 400 or 404).
    const reasonOf = (request: Parameters<InsightService['forActivity']>[0]) =>
      insight.forActivity(request).then(
        () => 'answered',
        (error: unknown) => (error as InsightScopeError).reason,
      );
    expect(await reasonOf({ contentId: fx.questionSetId, context: 'portal', version: 3 })).toBe(
      'versionUnavailable',
    );
    expect(await reasonOf({ contentId: '0190f5d2-0000-7000-8000-00000000dead', context: 'portal' })).toBe(
      'activityUnavailable',
    );
  });

  it('[INS-007] lists the portal and each course of the activity with its label', async () => {
    expect(await insight.contexts(fx.questionSetId)).toEqual([
      { key: 'portal', label: null },
      { key: fx.courseA, label: 'PED101' },
      { key: fx.courseB, label: null },
    ]);
  });

  it('[INS-005] numbers of the video match the fixture through the database', async () => {
    // Act and assert: the video and the ImageHotspots through the facade.
    const report = await insight.forActivity({ contentId: fx.videoId, context: fx.courseA });
    expect(
      report.videoEngagement?.map(({ item, answered, share }) => [item, shown(answered), shown(share)])[0],
    ).toEqual([IV1, 18, 0.9]);
    expect(report.participation.completed).toBeNull();
    const hotspots = await insight.forActivity({ contentId: fx.hotspotsId, context: fx.courseA });
    expect(hotspots.activity.sendsLearningData).toBe(false);
  });
});

describe('[INS-007] insight scope errors', () => {
  it.each([
    ['not a UUID', { contentId: 'nope', context: 'portal' }, 'activityUnavailable'],
    [
      'a malformed context',
      { contentId: '0190f5d2-0000-7000-8000-000000000001', context: 'course-1' },
      'contextInvalid',
    ],
  ] as const)('[INS-007] refuses %s before any query', async (_name, request, reason) => {
    // Arrange: a database that fails on any use, so the refusal comes first.
    const db = new Proxy(
      {},
      {
        get: () => {
          throw new Error('no query expected');
        },
      },
    ) as never;
    const service = new InsightService({ db, content: {} as never, groupSize: minimumGroupSize(5) });
    // Act
    const refusal = service.forActivity(request).catch((error: unknown) => error);
    // Assert
    const error = await refusal;
    expect(error).toBeInstanceOf(InsightScopeError);
    expect((error as InsightScopeError).reason).toBe(reason);
  });
});
