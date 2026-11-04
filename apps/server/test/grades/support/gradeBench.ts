/**
 * gradeBench — the whole app with the mock Canvas, set up for the grade worker: graded placements with their own
 * mock line items and rosters, learners launched into them, results stored as the ingestion stores them and queued
 * through the real enqueuer, and worker runs at moments the test names.
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
 *   - A result is stored as an `XapiStatement` before the enqueuer sees it, since the worker reads the stored results
 *     when it sends (D-104's amendment of 2026-11-04); `store` alone is a result whose job write failed.
 * Collaborators: ./benchLearner.ts, ./storedResult.ts, ../../support/appTestbed.ts,
 *   ../../../src/grades/gradeSyncRun.ts, ../../../src/grades/GradeJobEnqueuer.ts,
 *   ../../../../../tools/mock-platform/mockPlatform.mjs.
 * Tests: apps/server/test/grades/gradeSyncWorker.int.test.ts, gradeSyncFaults.int.test.ts, gradeSyncWindow.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import { CANVAS_USERS, LTI_ROLE } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import type { Principal } from '../../../src/auth/Principal.js';
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
import { learnerOf } from './benchLearner.js';
import { storeGradableResult } from './storedResult.js';

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

/** A learner's gradable result in a placement: its attempt number, scaled score (0–1) and bench minute. */
export type BenchResult = (
  placement: BenchPlacement,
  learner: BenchLearner,
  attempt: number,
  scaled: number,
  minute: number,
) => Promise<void>;

/** The bench. */
export interface GradeBench {
  readonly bed: AppTestbed;
  readonly runDeps: GradeSyncRunDeps;
  /** The activity every placement opens. */
  readonly contentId: string;
  /** A placement with its own course; `learners` mock Canvas users are on its roster as learners. */
  placement(options?: {
    policy?: 'best' | 'latest' | 'mastery';
    threshold?: number;
    learners?: number;
  }): Promise<{
    placement: BenchPlacement;
    learners: BenchLearner[];
  }>;
  /** Stores a gradable result at a bench moment and queues it through the enqueuer. */
  readonly result: BenchResult;
  /** Stores a gradable result at a bench moment without queuing it (a job write that failed). */
  readonly store: BenchResult;
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
  const store = (
    placement: BenchPlacement,
    learner: BenchLearner,
    attempt: number,
    scaled: number,
    minute: number,
  ) =>
    storeGradableResult(
      bed.db,
      {
        contentId: content,
        platformId: bed.platformId,
        contextId: placement.contextId,
        learnerKey: learner.principal.learnerKey,
      },
      { attemptId: `${viewId}:${attempt}`, scaled, timestamp: at(minute) },
    );
  return {
    bed,
    runDeps,
    contentId: content,
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
      const row = await store(placement, learner, attempt, scaled, minute);
      await enqueuer.enqueue([row], learner.principal, learner.sub);
    },
    store: async (placement, learner, attempt, scaled, minute) => {
      await store(placement, learner, attempt, scaled, minute);
    },
    run: (minute, ...placements) =>
      runGradeSync({ ...runDeps, placementIds: placements.map((p) => p.id) }, at(minute)),
    jobs: (placement) =>
      bed.db.gradeSyncJob.findMany({ where: { placementId: placement.id }, orderBy: { attemptId: 'asc' } }),
    close: () => bed.close(),
  };
}
