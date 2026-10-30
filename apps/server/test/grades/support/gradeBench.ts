/**
 * gradeBench — the whole app with the mock Canvas, set up for the grade worker: graded placements with their own
 * mock line items and rosters, learners launched into them, results queued through the real enqueuer, and worker
 * runs at moments the test names.
 *
 * Why: LTI-012's Verify asks for integration tests with a mock AGS endpoint (success, 5xx retry, 404 orphaned,
 *      idempotency); D-104's client signs with the tool key ltijs stores for the platform, so the bench registers
 *      the mock Canvas as the app does (./../../support/appTestbed.ts) and the worker reads the key through ltijs.
 * Spec: LTI-012
 * Invariants:
 *   - Moments are minutes after 1 January 2099, so a worker running elsewhere on the shared database (an e2e server)
 *     never finds these jobs due; each run claims only this bench's placements.
 *   - The score sender lives as long as the bench, so its token is reused as in production.
 *   - The jitter is fixed (0.5), so a retry falls exactly 1, 3, 9, … minutes later.
 * Collaborators: ../../support/appTestbed.ts, ../../../src/grades/gradeSyncRun.ts,
 *   ../../../src/grades/GradeJobEnqueuer.ts, ../../../../../tools/mock-platform/mockPlatform.mjs.
 * Tests: apps/server/test/grades/gradeSyncWorker.int.test.ts, gradeSyncFaults.int.test.ts, gradeSyncWindow.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import { CANVAS_USERS, LTI_ROLE } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { sealPrincipal, type Principal } from '../../../src/auth/Principal.js';
import type { GradeSyncJob } from '../../../src/generated/prisma/client.js';
import { GradeJobEnqueuer } from '../../../src/grades/GradeJobEnqueuer.js';
import { agsScoreSender } from '../../../src/grades/GradeSyncWorker.js';
import {
  runGradeSync,
  type GradeSyncRunCounts,
  type GradeSyncRunDeps,
} from '../../../src/grades/gradeSyncRun.js';
import { DataEncryption } from '../../../src/security/keys/DataEncryption.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { uniqueName } from '../../support/services.js';
import { gradableRow } from './gradeDbFixture.js';

/** The bench's moments start here. */
export const BENCH_EPOCH = Date.UTC(2099, 0, 1);
/**
 * A moment of the bench.
 * @param minutes - Minutes after 1 January 2099.
 * @returns The moment.
 */
export const at = (minutes: number): Date => new Date(BENCH_EPOCH + minutes * 60_000);

/** A graded placement with its mock line item. */
export interface BenchPlacement {
  readonly id: string;
  readonly contextId: string;
  readonly resourceLinkId: string;
  readonly lineItemUrl: string;
}

/** A learner of a placement: the principal and the LTI `sub` the mock Canvas knows. */
export interface BenchLearner {
  readonly principal: Principal;
  readonly sub: string;
}

/** The bench. */
export interface GradeBench {
  readonly bed: AppTestbed;
  readonly runDeps: GradeSyncRunDeps;
  /** A placement with its own course; `learners` mock Canvas users are on its roster as learners. */
  placement(options?: {
    policy?: 'best' | 'latest' | 'mastery';
    threshold?: number;
    learners?: number;
  }): Promise<{
    placement: BenchPlacement;
    learners: BenchLearner[];
  }>;
  /** Queues a gradable result through the enqueuer at a bench moment. */
  result(
    placement: BenchPlacement,
    learner: BenchLearner,
    attempt: number,
    scaled: number,
    minute: number,
  ): Promise<void>;
  /** Runs the worker once at a bench moment, over the given placements. */
  run(minute: number, ...placements: BenchPlacement[]): Promise<GradeSyncRunCounts>;
  /** A placement's jobs, by attempt. */
  jobs(placement: BenchPlacement): Promise<GradeSyncJob[]>;
  close(): Promise<void>;
}

/**
 * Opens the bench.
 * @returns The bench; close it after the tests.
 */
export async function openGradeBench(): Promise<GradeBench> {
  const bed = await openAppTestbed();
  const encryption = new DataEncryption(bed.env.DATA_ENCRYPTION_KEYS);
  const { logger } = capturedLogger('debug');
  const runDeps: GradeSyncRunDeps = {
    db: bed.db,
    encryption,
    logger,
    sender: agsScoreSender(bed.lti.provider.platformManager),
    random: () => 0.5,
  };
  const content = await bed.activity(await bed.staffAccount());
  const viewId = randomUUID();
  return {
    bed,
    runDeps,
    placement: async (options = {}) => {
      const contextId = uniqueName('course');
      const subs = [
        CANVAS_USERS.student.sub,
        ...Array.from({ length: (options.learners ?? 1) - 1 }, randomUUID),
      ];
      bed.mock.canvas.nrps.setMembers(
        contextId,
        subs.map((user_id) => ({ user_id, roles: [LTI_ROLE.learner] })),
      );
      const lineItem = bed.mock.canvas.ags.addLineItem({
        courseId: contextId,
        label: 'Quiz (formativ)',
        scoreMaximum: 100,
      });
      const row = await bed.db.ltiPlacement.create({
        data: {
          platformId: bed.platformId,
          contextId,
          resourceLinkId: uniqueName('link'),
          contentId: content,
          lineItemUrl: lineItem.id,
          attemptPolicy: options.policy ?? 'best',
          masteryThreshold: options.threshold ?? null,
        },
      });
      const placement = {
        id: row.id,
        contextId,
        resourceLinkId: row.resourceLinkId,
        lineItemUrl: lineItem.id,
      };
      const learners = subs.map((sub) => ({ sub, principal: learnerOf(bed.platformId, placement, content) }));
      return { placement, learners };
    },
    result: async (placement, learner, attempt, scaled, minute) => {
      const enqueuer = new GradeJobEnqueuer({ db: bed.db, encryption, logger, clock: () => at(minute) });
      const row = gradableRow(content, { attemptId: `${viewId}:${attempt}`, scaled, timestamp: at(minute) });
      await enqueuer.enqueue([row], learner.principal, learner.sub);
    },
    run: (minute, ...placements) =>
      runGradeSync({ ...runDeps, placementIds: placements.map((p) => p.id) }, at(minute)),
    jobs: (placement) =>
      bed.db.gradeSyncJob.findMany({ where: { placementId: placement.id }, orderBy: { attemptId: 'asc' } }),
    close: () => bed.close(),
  };
}

/** A learner principal from a launch into the placement. */
function learnerOf(platformId: string, placement: BenchPlacement, contentId: string): Principal {
  return sealPrincipal({
    userId: randomUUID(),
    learnerKey: uniqueName('learner'),
    roles: ['learner'],
    mode: 'lti',
    locale: 'nn',
    hvlMember: false,
    feideAuthenticated: false,
    studentAuthor: false,
    lti: {
      platformId,
      deploymentId: '1',
      contextId: placement.contextId,
      resourceLinkId: placement.resourceLinkId,
      contentId,
      lineItemUrl: placement.lineItemUrl,
      messageType: 'LtiResourceLinkRequest',
    },
  });
}
