/**
 * gradeSyncFixture — an activity placed in Canvas courses, with grade-sync jobs in every state, for the status and
 * retry tests and the accessibility scan of the grade-sync panel.
 *
 * Why: the status counts (LTI-012) and who sees which placement (D-106) need a known spread: an owner, a co-author, a
 *      colleague who may only view, two platforms, a course with a gradebook column and one without, and jobs that
 *      were sent, wait, failed (with and without the encrypted `sub`, D-104) and lost their line item.
 * Spec: LTI-012
 * Invariants:
 *   - Every row the fixture creates is removed by `close` (platforms cascade to placements and jobs; activities and
 *     users by ID), so parallel and repeated runs never see each other's rows.
 *   - Learner keys and `sub`s are made-up test values; the encrypted `sub` is a placeholder the status never reads.
 * Collaborators: ../gradeSyncRoutes.int.test.ts, ../gradeSyncRetry.int.test.ts,
 *   apps/server/a11y/support/gradeSyncSeed.ts.
 * Tests: shared by the tests named above.
 */
import { randomUUID } from 'node:crypto';
import type { Database } from '../../../../src/infra/prismaClient.js';

/** Job counts to create, by stored status; `failedWithoutSub` are failed jobs whose `sub` was removed (D-104). */
export interface JobSpread {
  readonly succeeded?: number;
  readonly pending?: number;
  readonly failed?: number;
  readonly failedWithoutSub?: number;
  readonly orphaned?: number;
}

/**
 * Creates a Canvas platform row with a host of its own.
 * @param db - The database.
 * @param name - The platform's name, as `LTI_PLATFORMS` would give it.
 * @returns The platform's ID.
 */
export async function createTestPlatform(db: Database, name: string): Promise<string> {
  const host = `canvas-${randomUUID()}.grades.test`;
  const platform = await db.ltiPlatform.create({
    data: {
      url: `https://${host}`,
      clientId: 'client',
      name,
      authenticationEndpoint: `https://${host}/auth`,
      accessTokenEndpoint: `https://${host}/token`,
      idTokenValidationMethod: 'JWK_SET',
      idTokenValidationKey: `https://${host}/jwks`,
      publicKey: 'public',
      privateKeyEncrypted: Buffer.from('encrypted'),
    },
  });
  return platform.id;
}

/**
 * Creates jobs of one placement, each for its own made-up learner and attempt.
 * @param db - The database.
 * @param placementId - The placement.
 * @param spread - How many jobs of each status.
 */
export async function createJobs(db: Database, placementId: string, spread: JobSpread): Promise<void> {
  const rows = Object.entries(spread).flatMap(([kind, count]) =>
    Array.from({ length: count as number }, () => {
      const learnerKey = `learner-${randomUUID()}`;
      const attemptId = `${randomUUID()}:1`;
      const status = kind === 'failedWithoutSub' ? 'failed' : (kind as 'succeeded' | 'pending' | 'failed');
      const stopped = status !== 'pending';
      return {
        placementId,
        learnerKey,
        attemptId,
        scoreGiven: 80,
        resultAt: new Date(),
        status,
        attempts: stopped ? 8 : 0,
        lastError: status === 'failed' ? 'http-503' : null,
        idempotencyKey: `${placementId}:${learnerKey}:${attemptId}`,
        nextAttemptAt: stopped ? null : new Date(),
        terminalAt: stopped ? new Date() : null,
        ltiSubEncrypted: kind === 'failedWithoutSub' ? null : Buffer.from('encrypted-sub'),
      };
    }),
  );
  await db.gradeSyncJob.createMany({ data: rows });
}

/** The people, platforms, activities and placements of the fixture. */
export interface GradeSyncFixture {
  readonly ownerId: string;
  readonly coAuthorId: string;
  /** A colleague at HVL who may view the activity (shared with HVL) but neither owns nor co-authors it. */
  readonly colleagueId: string;
  readonly contentId: string;
  /** Another activity of the same owner, with its own placement. */
  readonly otherContentId: string;
  readonly platformA: string;
  readonly platformB: string;
  /** Placements of the activity: course SYK110 on A (graded), course NAT200 on B (graded), course SYK110 on B
   * (no gradebook column, mastery policy). */
  readonly placements: { readonly a110: string; readonly b200: string; readonly b110Ungraded: string };
  /** The other activity's placement, in course SYK110 on A. */
  readonly otherPlacement: string;
  /** Removes every row the fixture made. */
  close(): Promise<void>;
}

/**
 * Creates the fixture: users, two published activities shared with HVL, two platforms, four placements and no jobs.
 * @param db - The database.
 * @returns The fixture; call `close` after the tests.
 */
export async function createGradeSyncFixture(db: Database): Promise<GradeSyncFixture> {
  const user = async () => (await db.user.create({ data: { kind: 'staff' } })).id;
  const [ownerId, coAuthorId, colleagueId] = [await user(), await user(), await user()];
  const activity = async (title: string) =>
    (
      await db.h5PContent.create({
        data: {
          mainLibrary: 'H5P.MultiChoice',
          title,
          params: {},
          metadata: {},
          ownerUserId: ownerId,
          status: 'published',
          visibility: 'organisation',
        },
      })
    ).id;
  const contentId = await activity('Celler og vev');
  const otherContentId = await activity('Anna aktivitet');
  await db.contentCollaborator.create({ data: { contentId, userId: coAuthorId, role: 'coauthor' } });
  const platformA = await createTestPlatform(db, 'HVL Canvas');
  const platformB = await createTestPlatform(db, 'HVL Canvas test');
  const place = async (
    platformId: string,
    contextId: string,
    extra: { contentId?: string; graded?: boolean; mastery?: boolean } = {},
  ) =>
    (
      await db.ltiPlacement.create({
        data: {
          platformId,
          contextId,
          resourceLinkId: `link-${randomUUID()}`,
          contentId: extra.contentId ?? contentId,
          contextLabel: contextId,
          lineItemUrl: extra.graded === false ? null : `https://canvas.test/lineitems/${randomUUID()}`,
          ...(extra.mastery ? { attemptPolicy: 'mastery' as const } : {}),
        },
      })
    ).id;
  const placements = {
    a110: await place(platformA, 'SYK110'),
    b200: await place(platformB, 'NAT200'),
    b110Ungraded: await place(platformB, 'SYK110', { graded: false, mastery: true }),
  };
  const otherPlacement = await place(platformA, 'SYK110', { contentId: otherContentId });
  return {
    ownerId,
    coAuthorId,
    colleagueId,
    contentId,
    otherContentId,
    platformA,
    platformB,
    placements,
    otherPlacement,
    close: async () => {
      await db.ltiPlatform.deleteMany({ where: { id: { in: [platformA, platformB] } } });
      await db.auditEvent.deleteMany({ where: { actorUserId: { in: [ownerId, coAuthorId, colleagueId] } } });
      await db.h5PContent.deleteMany({ where: { id: { in: [contentId, otherContentId] } } });
      await db.user.deleteMany({ where: { id: { in: [ownerId, coAuthorId, colleagueId] } } });
    },
  };
}
