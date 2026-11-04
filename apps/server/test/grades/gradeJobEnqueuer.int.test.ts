/**
 * Integration tests for the grade enqueuer (LTI-012, D-104, D-115): which stored rows queue a score, the job it
 * writes (score, attempt, result time, academic year, the `sub` encrypted only), and one job per placement and
 * learner (D-104's amendment of 2026-11-04), including concurrent writes, a batch of several results, a pending job
 * that keeps its backoff and a stopped job that a new result reopens with 24 hours of its own.
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
// WHY: jobs due in 2099 are never claimed by a grade worker that a dev or e2e server runs on the shared database.
const NOW = new Date('2099-10-30T10:00:05.000Z');

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
      idempotencyKey: `${placement.id}:${learner.learnerKey}`,
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

  it('[LTI-012] keeps one job per placement and learner, also for concurrent writes and other attempts', async () => {
    // Arrange
    const placement = await fx.placement();
    const learner = fx.principal(placement);
    const first = gradableRow(fx.contentId);
    const second = gradableRow(fx.contentId, {
      attemptId: `${VIEW_ID}:2`,
      scaled: 1,
      timestamp: new Date('2026-10-30T10:01:00.000Z'),
    });
    // Act
    await Promise.all([enqueuer.enqueue([first], learner, SUB), enqueuer.enqueue([first], learner, SUB)]);
    const again = await enqueuer.enqueue([second], learner, SUB);
    // Assert: the job took in the newer attempt; the worker reads both stored results when it sends
    expect(again).toEqual({ created: 0, updated: 1 });
    const jobs = await fx.db.gradeSyncJob.findMany({ where: { placementId: placement.id } });
    expect(jobs.map((job) => [job.attemptId, job.scoreGiven, job.resultAt])).toEqual([
      [`${VIEW_ID}:2`, 100, second.timestamp],
    ]);
  });

  it('[LTI-012] writes one job for a batch of several results and takes in the newest by result order', async () => {
    // Arrange: a flood of results in one batch, the newest not last in the list
    const placement = await fx.placement();
    const learner = fx.principal(placement);
    const rows = Array.from({ length: 50 }, (_, i) =>
      gradableRow(fx.contentId, {
        attemptId: `${VIEW_ID}:${i + 1}`,
        scaled: (i % 4) / 4,
        timestamp: new Date(Date.UTC(2026, 9, 30, 10, 0, 0, i === 7 ? 999 : i)),
      }),
    );
    // Act
    const counts = await enqueuer.enqueue(rows, learner, SUB);
    // Assert
    expect(counts).toEqual({ created: 1, updated: 0 });
    const jobs = await fx.db.gradeSyncJob.findMany({ where: { placementId: placement.id } });
    expect(jobs.map((job) => [job.attemptId, job.scoreGiven])).toEqual([[`${VIEW_ID}:8`, 75]]);
  });

  it('[LTI-012] keeps a pending job’s backoff, and reopens a stopped one with a new creation time', async () => {
    // Arrange: one learner's job in backoff, another learner's job that succeeded
    const placement = await fx.placement();
    const [waiting, done] = [fx.principal(placement), fx.principal(placement)];
    await enqueuer.enqueue([gradableRow(fx.contentId)], waiting!, SUB);
    await enqueuer.enqueue([gradableRow(fx.contentId)], done!, SUB);
    const backoff = new Date('2099-10-30T10:30:00.000Z');
    const jobOf = (learner: typeof waiting) => ({
      where: { placementId: placement.id, learnerKey: learner!.learnerKey },
    });
    await fx.db.gradeSyncJob.updateMany({
      ...jobOf(waiting),
      data: { attempts: 3, nextAttemptAt: backoff, lastError: 'http-503' },
    });
    await fx.db.gradeSyncJob.updateMany({
      ...jobOf(done),
      data: { attempts: 1, status: 'succeeded', terminalAt: NOW, succeededAt: NOW, nextAttemptAt: null },
    });
    const later = new Date('2099-10-30T11:00:00Z');
    const laterEnqueuer = new GradeJobEnqueuer({ db: fx.db, encryption, logger, clock: () => later });
    const next = gradableRow(fx.contentId, { attemptId: `${VIEW_ID}:2`, scaled: 0.5 });
    // Act
    const counts = [
      await laterEnqueuer.enqueue([next], waiting!, SUB),
      await laterEnqueuer.enqueue([next], done!, SUB),
    ];
    // Assert
    expect(counts).toEqual([
      { created: 0, updated: 1 },
      { created: 0, updated: 1 },
    ]);
    expect(await fx.db.gradeSyncJob.findFirst(jobOf(waiting))).toMatchObject({
      attemptId: `${VIEW_ID}:2`,
      scoreGiven: 50,
      status: 'pending',
      attempts: 3,
      nextAttemptAt: backoff,
      createdAt: NOW,
    });
    expect(await fx.db.gradeSyncJob.findFirst(jobOf(done))).toMatchObject({
      scoreGiven: 50,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: later,
      createdAt: later,
      terminalAt: null,
      succeededAt: null,
      lastError: null,
    });
  });

  it('[LTI-012] onStored, the ingestion listener, queues the same jobs as enqueue', async () => {
    // Arrange
    const placement = await fx.placement();
    const learner = fx.principal(placement);
    // Act
    await enqueuer.onStored([gradableRow(fx.contentId)], learner, { ltiSubject: SUB });
    // Assert
    expect(await fx.db.gradeSyncJob.count({ where: { placementId: placement.id } })).toBe(1);
  });
});
