/**
 * Integration tests of how much one insight view reads (D-122), on PostgreSQL: the rows come in pages and give the
 * same view as a read at once; a scope with more stored statements than one view covers is refused before a row is
 * read; and the view and its CSV answer that refusal with 422, without an audit entry.
 *
 * Spec: INS-001, INS-009
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import { PrismaContentStorage } from '../../../src/h5p/storage/PrismaContentStorage.js';
import type { S3ContentFileStore } from '../../../src/h5p/storage/S3ContentFileStore.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import type { InsightReadLimits } from '../../../src/insight/data/readInsightStatements.js';
import { InsightService } from '../../../src/insight/InsightService.js';
import { InsightScopeError } from '../../../src/insight/scope/insightScope.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { NO_LIMIT } from '../../grades/status/support/gradeSyncApp.js';
import { describeWithServices } from '../../support/services.js';
import { FIXTURE_NOW, PERIOD_START } from '../fixtures/thirtyLearners.js';
import { OWN_PAGE_FETCH } from '../../support/ownPageFetch.js';
import { openInsightHttpBench, portalPrincipal, type InsightHttpBench } from './support/insightHttpBench.js';

const PAGE = 7;

describeWithServices('[INS-001] how much one insight view reads', () => {
  let bench: InsightHttpBench;
  let owner: Principal;
  /** The rows of the fixture's view: course A, version 2, the last 7 days. */
  let inView: number;
  /** How many rows each read of the statements asked the database for, in order. */
  let asked: number[];
  /** The insight core with its own limits, on a database that notes what each statement read asks for. */
  const insightWith = (readLimits: InsightReadLimits): InsightService => {
    const statements = {
      findMany: (args: { readonly take?: number }) => {
        asked.push(args.take ?? Number.POSITIVE_INFINITY);
        return bench.db.xapiStatement.findMany(args as never);
      },
    };
    const db = {
      h5PContent: bench.db.h5PContent,
      ltiPlacement: bench.db.ltiPlacement,
      xapiStatement: statements,
    };
    return new InsightService({
      db: db as unknown as Database,
      content: new PrismaContentStorage(bench.db, {} as S3ContentFileStore),
      learnerCounts: { read: () => Promise.resolve({ count: 40, countedAt: FIXTURE_NOW }) },
      groupSize: minimumGroupSize(5),
      clock: () => FIXTURE_NOW,
      readLimits,
    });
  };
  beforeAll(async () => {
    bench = await openInsightHttpBench();
    owner = portalPrincipal(bench.ownerId);
    inView = await bench.db.xapiStatement.count({
      where: {
        contentId: bench.contentId,
        contentVersion: 2,
        contextId: bench.fx.courseA,
        timestamp: { gte: PERIOD_START, lt: new Date('2026-11-03T23:00:00.000Z') },
      },
    });
  });
  afterAll(() => bench.close());

  it('[INS-001] a view at the limit, read in pages, is the same view as one read at once', async () => {
    // Arrange
    asked = [];
    const paged = insightWith({ maxStatements: inView, pageSize: PAGE });
    // Act
    const report = await paged.forActivity({ contentId: bench.contentId, context: bench.fx.courseA });
    const whole = await bench.insight.forActivity({ contentId: bench.contentId, context: bench.fx.courseA });
    // Assert: the same numbers, and no read asked for more than a page
    expect(inView).toBeGreaterThan(3 * PAGE);
    expect(report).toEqual(whole);
    expect(asked[0]).toBe(1);
    expect(asked.slice(1)).toEqual(Array.from({ length: Math.floor(inView / PAGE) + 1 }, () => PAGE));
  });

  it('[INS-001] a scope with one statement more than a view covers is refused before a row is read', async () => {
    // Arrange
    asked = [];
    const small = insightWith({ maxStatements: inView - 1, pageSize: PAGE });
    // Act
    const refused = await small
      .forActivity({ contentId: bench.contentId, context: bench.fx.courseA })
      .catch((error: unknown) => error);
    // Assert: only the question "are there more?" reached the database
    expect(refused).toBeInstanceOf(InsightScopeError);
    expect((refused as InsightScopeError).reason).toBe('viewTooLarge');
    expect(asked).toEqual([1]);
  });

  it('[INS-009] the view and its CSV answer 422 `insight.viewTooLarge`, in the person’s language, and nothing is audited', async () => {
    // Arrange
    asked = [];
    const services = { insight: insightWith({ maxStatements: inView - 1, pageSize: PAGE }), limit: NO_LIMIT };
    const get = (path: string) =>
      request(bench.appAs(owner, { services }))
        .get(`/api/content/${bench.contentId}/insight${path}`)
        .set(OWN_PAGE_FETCH);
    await bench.db.auditEvent.deleteMany({ where: { targetId: bench.contentId } });
    // Act
    const view = await get(`?context=${bench.fx.courseA}`);
    const csv = await get(`/export?context=${bench.fx.courseA}`);
    const shorter = await get('?context=portal');
    // Assert
    expect([view.status, csv.status]).toEqual([422, 422]);
    expect(view.body).toMatchObject({ errorCode: 'insight.viewTooLarge' });
    expect(view.body.message).toContain('Vel ein kortare periode');
    expect(csv.headers['content-type']).toContain('application/json');
    expect(await bench.db.auditEvent.count({ where: { targetId: bench.contentId } })).toBe(1);
    // Assert: a scope within the limit is still served (the one audit entry is its)
    expect(shorter.status).toBe(200);
  });
});
