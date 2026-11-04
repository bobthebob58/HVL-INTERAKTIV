/**
 * insightHttpBench — the insight routes on the test database with an injected principal: the 30-learner fixture's
 * QuestionSet (published, shared with HVL), its owner, a co-author, an HVL colleague who may only view it, an admin,
 * and its Canvas courses A (labelled) and B (unlabelled) on one platform.
 *
 * Why: who may see which context (INS-007, D-106) is tested with every kind of person, and the numbers must be the
 *      core's (the fixture's hand-calculated values) after they pass the HTTP layer. Only the authentication is
 *      replaced; the routes, the access rules, the insight core, the content store, the publish flow's findings, the
 *      schemas and the error handler are the server's own.
 * Spec: INS-007, INS-009, INS-010
 * Invariants:
 *   - The view's clock is the fixture's `FIXTURE_NOW`, so the 7-day view holds the fixture's rows.
 *   - Every row the bench adds (people, a collaborator, acknowledgements, audit events) is removed by `close`, after
 *     the fixture's own rows.
 * Collaborators: ../../support/insightDbFixture.ts, ../../../grades/status/support/gradeSyncApp.ts (principals),
 *   ../../../../src/insight/http/insightRoutes.ts, ../../../../src/http/h5pErrorHandler.ts.
 * Tests: used by ../insightPermissions.int.test.ts, ../insightRoutes.int.test.ts, ../insightFindings.int.test.ts,
 *   ../insightRateLimit.int.test.ts, ../insightApi.int.test.ts.
 */
import express, { type Express } from 'express';
import type { Principal } from '../../../../src/auth/Principal.js';
import { setPrincipal } from '../../../../src/auth/principalLocals.js';
import { ContentPublisher } from '../../../../src/content/ContentPublisher.js';
import { PrismaContentAccessRepository } from '../../../../src/h5p/permissions/ContentAccessRepository.js';
import { PrismaContentStorage } from '../../../../src/h5p/storage/PrismaContentStorage.js';
import type { S3ContentFileStore } from '../../../../src/h5p/storage/S3ContentFileStore.js';
import { h5pErrorHandler } from '../../../../src/http/h5pErrorHandler.js';
import { insightRoutes, type InsightServices } from '../../../../src/insight/http/insightRoutes.js';
import { InsightService } from '../../../../src/insight/InsightService.js';
import type { Database } from '../../../../src/infra/prismaClient.js';
import type { PersonLimit } from '../../../../src/learningDesign/collaboration/PersonRateLimit.js';
import { createLogger } from '../../../../src/logging/logger.js';
import { minimumGroupSize } from '../../../../src/privacy/minimumGroupSize.js';
import type { ContentValidator } from '../../../../src/validation/types.js';
import { NO_LIMIT } from '../../../grades/status/support/gradeSyncApp.js';
import { FIXTURE_NOW } from '../../fixtures/thirtyLearners.js';
import { openInsightDbFixture, type InsightDbFixture } from '../../support/insightDbFixture.js';

export { canvasPrincipal, portalPrincipal } from '../../../grades/status/support/gradeSyncApp.js';

/** How one test app differs from the default. */
export interface BenchOptions {
  /** The per-person limit; never refuses by default. */
  readonly limit?: PersonLimit;
  /** The validator behind the findings; finds nothing by default. */
  readonly validator?: ContentValidator;
  /** The insight services, or null for an app that has not wired them. */
  readonly services?: InsightServices | null;
}

/** The fixture, its people and a way to call the routes as one of them. */
export interface InsightHttpBench {
  readonly fx: InsightDbFixture;
  readonly db: Database;
  /** The QuestionSet (version 2), placed in courses A and B. */
  readonly contentId: string;
  readonly ownerId: string;
  readonly coAuthorId: string;
  readonly colleagueId: string;
  readonly adminId: string;
  readonly platformId: string;
  /** The insight core as the bench's apps use it. */
  readonly insight: InsightService;
  /**
   * The routes as one principal sees them.
   * @param principal - Who makes the requests; nobody when undefined.
   * @param options - The limit, the validator or the services.
   * @returns The app, with the routes under `/api`.
   */
  appAs(principal: Principal | undefined, options?: BenchOptions): Express;
  close(): Promise<void>;
}

/**
 * Opens the bench.
 * @returns The bench; call `close` after the tests.
 */
export async function openInsightHttpBench(): Promise<InsightHttpBench> {
  const fx = await openInsightDbFixture();
  const { db } = fx;
  const staff = async () => (await db.user.create({ data: { kind: 'staff' } })).id;
  const [coAuthorId, colleagueId, adminId] = [await staff(), await staff(), await staff()];
  const activity = await db.h5PContent.update({
    where: { id: fx.questionSetId },
    data: { status: 'published', visibility: 'organisation' },
  });
  await db.contentCollaborator.create({
    data: { contentId: activity.id, userId: coAuthorId, role: 'coauthor' },
  });
  const insight = new InsightService({
    db,
    // WHY: only the parameters and metadata are read; the S3 file store is never touched here.
    content: new PrismaContentStorage(db, {} as S3ContentFileStore),
    learnerCounts: {
      read: (key) => Promise.resolve(key === fx.courseA ? { count: 40, countedAt: FIXTURE_NOW } : undefined),
    },
    groupSize: minimumGroupSize(5),
    clock: () => FIXTURE_NOW,
  });
  const people = [activity.ownerUserId, coAuthorId, colleagueId, adminId];
  return {
    fx,
    db,
    contentId: activity.id,
    ownerId: activity.ownerUserId,
    coAuthorId,
    colleagueId,
    adminId,
    platformId: fx.courseA.split(':')[0] ?? '',
    insight,
    appAs: (principal, options = {}) => {
      const publisher = new ContentPublisher({
        db,
        validator: options.validator ?? (() => []),
        clock: () => FIXTURE_NOW,
      });
      const services =
        options.services === null
          ? undefined
          : (options.services ?? { insight, limit: options.limit ?? NO_LIMIT });
      return express()
        .use((_req, res, next) => {
          if (principal) setPrincipal(res, principal);
          next();
        })
        .use(
          '/api',
          insightRoutes({
            db,
            access: new PrismaContentAccessRepository(db),
            findings: (contentId, locale) => publisher.findings(contentId, locale),
            services,
          }),
        )
        .use(h5pErrorHandler(createLogger({ level: 'silent' })));
    },
    close: async () => {
      await db.auditEvent.deleteMany({ where: { actorUserId: { in: people } } });
      await db.validationAcknowledgement.deleteMany({ where: { contentId: activity.id } });
      await db.contentCollaborator.deleteMany({ where: { contentId: activity.id } });
      await db.user.deleteMany({ where: { id: { in: [coAuthorId, colleagueId, adminId] } } });
      await fx.close();
    },
  };
}
