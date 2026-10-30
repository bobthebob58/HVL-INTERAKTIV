/**
 * Integration tests for the grade enqueuer (LTI-012, D-104, D-115): which stored rows queue a score, the job it
 * writes (score, attempt, result time, academic year, the `sub` encrypted only), and idempotency per placement,
 * learner and attempt, including concurrent writes and a stopped job that a repeated result reopens.
 *
 * Spec: LTI-012, DATA-002
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { GradeJobEnqueuer } from '../../src/grades/GradeJobEnqueuer.js';
import { DataEncryption } from '../../src/security/keys/DataEncryption.js';
import { capturedLogger } from '../support/capturedLogger.js';
import { describeWithServices, serviceEnv } from '../support/services.js';
import { gradableRow, openGradeDbFixture, VIEW_ID, type GradeDbFixture } from './support/gradeDbFixture.js';

const SUB = 'canvas-sub-4f1e2d';
const NOW = new Date('2026-10-30T10:00:05.000Z');

describeWithServices('[LTI-012] grade enqueuer', () => {
  let fx: GradeDbFixture;
  const encryption = new DataEncryption(serviceEnv().DATA_ENCRYPTION_KEYS);
  const { logger, lines } = capturedLogger('debug');
  let enqueuer: GradeJobEnqueuer;
  beforeAll(async () => {
    fx = await openGradeDbFixture();
    enqueuer = new GradeJobEnqueuer({ db: fx.db, encryption, logger, clock: () => NOW });
  });
  afterAll(() => fx.close());

  it('[LTI-012] queues a gradable result as a pending job with scaled × 100, and stores the sub encrypted only', async () => {
    // Arrange
    const placement = await fx.placement();
    const learner = fx.principal(placement);
    const row = gradableRow(fx.contentId, { scaled: 0.6667, academicYear: 2025 });
    // Act
    const counts = await enqueuer.enqueue([row], learner, SUB);
    // Assert
    expect(counts).toEqual({ created: 1, updated: 0 });
    const job = await fx.db.gradeSyncJob.findFirstOrThrow({ where: { placementId: placement.id } });
    expect(job).toMatchObject({
      learnerKey: learner.learnerKey,
      attemptId: `${VIEW_ID}:1`,
      scoreGiven: 66.67,
      resultAt: row.timestamp,
      academicYear: 2025,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: NOW,
      createdAt: NOW,
      idempotencyKey: `${placement.id}:${learner.learnerKey}:${VIEW_ID}:1`,
    });
    const stored = Buffer.from(job.ltiSubEncrypted ?? []);
    expect(stored.includes(SUB)).toBe(false);
    expect(encryption.decrypt('grade-lti-sub', stored).toString('utf8')).toBe(SUB);
    expect(lines.join('\n')).not.toContain(SUB);
  });

  it.each([
    ['an author', { roles: ['author'] as const }, {}],
    ['a sub-content answer', {}, { subContentId: 'b3f6' }],
    ['a root attempted', {}, { verb: 'attempted', scoreMax: null, scaled: null }],
    ['a result with maximum 0 (no-score)', {}, { scoreMax: 0, scaled: null }],
    ['a row about another activity', {}, { contentId: '00000000-0000-4000-8000-000000000000' }],
  ])('[LTI-012] queues nothing for %s', async (_name, who, overrides) => {
    // Arrange
    const placement = await fx.placement();
    const principal = fx.principal(placement, 'roles' in who ? who.roles : ['learner']);
    // Act
    const counts = await enqueuer.enqueue([gradableRow(fx.contentId, overrides)], principal, SUB);
    // Assert
    expect(counts).toEqual({ created: 0, updated: 0 });
    expect(await fx.db.gradeSyncJob.count({ where: { placementId: placement.id } })).toBe(0);
  });

  it('[LTI-012] queues nothing without the sub, for an ungraded or unknown placement, or for a portal play', async () => {
    // Arrange
    const graded = await fx.placement();
    const ungraded = await fx.placement(null);
    const learner = fx.principal(graded);
    const unknown = { ...learner, lti: { ...learner.lti!, resourceLinkId: 'not-placed' } };
    const portal = { ...learner, mode: 'portal' as const, lti: undefined };
    const row = gradableRow(fx.contentId);
    // Act
    const counts = [
      await enqueuer.enqueue([row], learner, undefined),
      await enqueuer.enqueue([row], fx.principal(ungraded), SUB),
      await enqueuer.enqueue([row], unknown, SUB),
      await enqueuer.enqueue([row], portal, SUB),
    ];
    // Assert
    expect(counts.every((c) => c.created + c.updated === 0)).toBe(true);
    expect(await fx.db.gradeSyncJob.count({ where: { placementId: { in: [graded.id, ungraded.id] } } })).toBe(
      0,
    );
  });

  it('[LTI-012] keeps one job per placement, learner and attempt, also for concurrent writes', async () => {
    // Arrange
    const placement = await fx.placement();
    const learner = fx.principal(placement);
    const first = gradableRow(fx.contentId);
    const second = gradableRow(fx.contentId, { attemptId: `${VIEW_ID}:2`, scaled: 1 });
    // Act
    await Promise.all([enqueuer.enqueue([first], learner, SUB), enqueuer.enqueue([first], learner, SUB)]);
    const again = await enqueuer.enqueue([first, second], learner, SUB);
    // Assert
    expect(again).toEqual({ created: 1, updated: 1 });
    const jobs = await fx.db.gradeSyncJob.findMany({
      where: { placementId: placement.id },
      orderBy: { attemptId: 'asc' },
    });
    expect(jobs.map((job) => [job.attemptId, job.scoreGiven])).toEqual([
      [`${VIEW_ID}:1`, 75],
      [`${VIEW_ID}:2`, 100],
    ]);
  });

  it('[LTI-012] updates a pending job in place and reopens a stopped one, keeping its creation time', async () => {
    // Arrange: one job in backoff, one that succeeded
    const placement = await fx.placement();
    const learner = fx.principal(placement);
    const [a, b] = [`${VIEW_ID}:1`, `${VIEW_ID}:2`].map((attemptId) =>
      gradableRow(fx.contentId, { attemptId }),
    );
    await enqueuer.enqueue([a!, b!], learner, SUB);
    const backoff = new Date('2026-10-30T10:30:00.000Z');
    await fx.db.gradeSyncJob.updateMany({
      where: { placementId: placement.id, attemptId: a!.attemptId },
      data: { attempts: 3, nextAttemptAt: backoff, lastError: 'http-503' },
    });
    await fx.db.gradeSyncJob.updateMany({
      where: { placementId: placement.id, attemptId: b!.attemptId },
      data: { attempts: 1, status: 'succeeded', terminalAt: NOW, succeededAt: NOW, nextAttemptAt: null },
    });
    const later = new GradeJobEnqueuer({
      db: fx.db,
      encryption,
      logger,
      clock: () => new Date('2026-10-30T11:00:00Z'),
    });
    // Act: the same attempts again, with other scores (LTI-013's forged case)
    const counts = await later.enqueue(
      [
        { ...a!, scaled: 0.5 },
        { ...b!, scaled: 0.25 },
      ],
      learner,
      SUB,
    );
    // Assert
    expect(counts).toEqual({ created: 0, updated: 2 });
    const jobs = await fx.db.gradeSyncJob.findMany({
      where: { placementId: placement.id },
      orderBy: { attemptId: 'asc' },
    });
    expect(jobs[0]).toMatchObject({
      scoreGiven: 50,
      status: 'pending',
      attempts: 3,
      nextAttemptAt: backoff,
      createdAt: NOW,
    });
    expect(jobs[1]).toMatchObject({
      scoreGiven: 25,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date('2026-10-30T11:00:00Z'),
      terminalAt: null,
      succeededAt: null,
      lastError: null,
      createdAt: NOW,
    });
  });

  it('[DATA-002] onStored, the ingestion listener, queues the same jobs as enqueue', async () => {
    // Arrange
    const placement = await fx.placement();
    const learner = fx.principal(placement);
    // Act
    await enqueuer.onStored([gradableRow(fx.contentId)], learner, { ltiSubject: SUB });
    // Assert
    expect(await fx.db.gradeSyncJob.count({ where: { placementId: placement.id } })).toBe(1);
  });
});
