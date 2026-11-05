/**
 * purgeFixture — two academic years of learner rows for the yearly purge's tests: an ended year E and the current year
 * E + 1, in every table the purge reads, with learner accounts on both sides of the cutoff; removed by `close`.
 *
 * Why: DATA-003's Verify is "integration test with time travel"; D-107 deletes by the stored year, writes snapshots
 *      first and leaves the current year alone, and its amendment of 2026-11-04 fixes which accounts go. The rows here
 *      make each rule visible: a statement of year E stored on 1 August of E + 1 (a portal session across the turn of
 *      the year, D-057), the current year's rows, a learner with an identity from each year, and accounts without one.
 * Spec: DATA-003
 * Invariants:
 *   - Years far in the past (the caller's E), so no other test's rows, which carry this year's, are ever selected; the
 *     purge's account rule (created before 1 August of E + 1) likewise meets only these accounts.
 *   - `clearPurgeYears` removes what an aborted run of these tests left, including their `purge.run` audit events,
 *     and touches nothing of a later year.
 *   - Expected counts (`EXPECTED_COUNTS`), hand-worked: 25 statements of E (6 + 10 + 1 in course X, version 1, and the
 *     test student's; 2 + 1 in the portal; 3 in version 2; the test student's alone in version 3), 3 states and 2 grade
 *     jobs of E; 2 learner identities and 2 learner accounts; 3 snapshots (portal v1, X v1, X v2), none counting the
 *     test student, and none for version 3, which only the test student played.
 * Tests: apps/server/test/privacy/purge/retentionPurge.int.test.ts,
 *   apps/server/test/privacy/purge/retentionPurgeFailure.int.test.ts,
 *   apps/server/test/privacy/purge/retentionPurgeJob.int.test.ts,
 *   apps/server/test/privacy/purge/retentionPurgeJobRetry.int.test.ts,
 *   apps/server/test/privacy/purge/yearSnapshotsConcurrency.int.test.ts,
 *   apps/server/test/privacy/purge/purgeRaces.int.test.ts,
 *   apps/server/test/privacy/purge/purgeBatches.int.test.ts (`clearPurgeYears` only)
 */
import { randomUUID } from 'node:crypto';
import { createPrismaClient, type Database } from '../../../../src/infra/prismaClient.js';
import { PURGE_RUN_ACTION } from '../../../../src/privacy/purge/purgeAudit.js';
import { serviceEnv, uniqueName } from '../../../support/services.js';
import { fixtureStatements } from './purgeFixtureRows.js';

/** What a run at the fixture's moment deletes and writes. */
export const EXPECTED_COUNTS = {
  snapshots: 3,
  gradeSyncJobs: 2,
  xapiStatements: 25,
  h5pUserData: 3,
  learnerIdentities: 2,
  learnerUsers: 2,
};

/** The fixture's accounts: which go (`old`, `bare`) and which stay. */
export type FixtureAccount = 'old' | 'linked' | 'fresh' | 'bare' | 'bareFresh' | 'staff';

/** The fixture's rows. */
export interface PurgeFixture {
  readonly db: Database;
  readonly ended: number;
  readonly current: number;
  readonly contentId: string;
  /** `<platformId>:X` (D-103). */
  readonly course: string;
  readonly accounts: Readonly<Record<FixtureAccount, string>>;
  /** Midnight in Oslo on 31 August of the current year: the default run date. */
  readonly runsAt: Date;
  close(): Promise<void>;
}

/**
 * Removes the rows and `purge.run` events an earlier run of these tests may have left, for every year up to `upTo`.
 * @param db - The test database.
 * @param upTo - The latest academic year to clear.
 * @returns When done.
 */
export async function clearPurgeYears(db: Database, upTo: number): Promise<void> {
  const years = { academicYear: { lte: upTo } };
  const before = { lt: new Date(Date.UTC(upTo + 1, 0, 1)) };
  await db.gradeSyncJob.deleteMany({ where: years });
  await db.xapiStatement.deleteMany({ where: years });
  await db.h5PUserData.deleteMany({ where: years });
  await db.identity.deleteMany({ where: { createdAt: before, user: { kind: 'learner' } } });
  await db.user.deleteMany({ where: { kind: 'learner', createdAt: before, identities: { none: {} } } });
  await db.auditEvent.deleteMany({ where: { action: PURGE_RUN_ACTION, targetId: { lte: String(upTo) } } });
}

/**
 * Writes the fixture for ended year `ended` and current year `ended + 1`.
 * @param ended - The ended academic year, far in the past (e.g. 2010).
 * @returns The fixture.
 */
export async function openPurgeFixture(ended: number): Promise<PurgeFixture> {
  const current = ended + 1;
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  await clearPurgeYears(db, current);
  const owner = await db.user.create({ data: { kind: 'staff' } });
  const content = await db.h5PContent.create({
    data: { mainLibrary: 'H5P.MultiChoice', title: 'Purge', params: {}, metadata: {}, ownerUserId: owner.id },
  });
  const url = `https://${uniqueName('purge')}.example`;
  const platform = await db.ltiPlatform.create({
    data: {
      url,
      clientId: '1',
      name: 'Canvas',
      authenticationEndpoint: 'https://sso.example/auth',
      accessTokenEndpoint: 'https://sso.example/token',
      idTokenValidationMethod: 'JWK_SET',
      idTokenValidationKey: 'https://sso.example/jwks',
      publicKey: 'p',
      privateKeyEncrypted: Buffer.from([1]),
    },
  });
  const placement = await db.ltiPlacement.create({
    data: {
      platformId: platform.id,
      contextId: 'X',
      resourceLinkId: uniqueName('link'),
      contentId: content.id,
    },
  });
  const course = `${platform.id}:X`;
  const run = randomUUID().slice(0, 8);
  const key = (name: string) => `purge-${run}-${name}`;
  await db.xapiStatement.createMany({ data: fixtureStatements(content.id, course, ended, key) });
  await db.h5PUserData.createMany({
    data: (
      [
        ['L1', ended],
        ['L2', ended],
        ['P1', ended],
        ['L1', current],
      ] as const
    ).map(([learner, academicYear]) => ({
      contentId: content.id,
      dataType: 'state',
      learnerKey: key(`${learner}-${academicYear}`),
      data: '{"answers":[1]}',
      academicYear,
    })),
  });
  await db.gradeSyncJob.createMany({
    data: [ended, ended, current].map((academicYear) => ({
      placementId: placement.id,
      learnerKey: key(randomUUID()),
      ltiSubEncrypted: new Uint8Array([1]),
      attemptId: `${randomUUID()}:1`,
      scoreGiven: 80,
      resultAt: new Date(Date.UTC(academicYear, 9, 1)),
      status: 'succeeded' as const,
      idempotencyKey: randomUUID(),
      nextAttemptAt: null,
      academicYear,
    })),
  });
  const at = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day, 10));
  const account = async (kind: 'learner' | 'staff', created: Date, identities: Date[]) => {
    const user = await db.user.create({ data: { kind, createdAt: created } });
    for (const createdAt of identities) {
      await db.identity.create({
        data: {
          userId: user.id,
          provider: 'lti',
          subjectHash: randomUUID(),
          subjectKeyId: 'k1',
          platformId: platform.id,
          createdAt,
        },
      });
    }
    return user.id;
  };
  const accounts: Record<FixtureAccount, string> = {
    old: await account('learner', at(ended, 9, 1), [at(ended, 9, 1)]),
    linked: await account('learner', at(ended, 9, 1), [at(ended, 9, 1), at(current, 8, 15)]),
    fresh: await account('learner', at(current, 8, 10), [at(current, 8, 10)]),
    bare: await account('learner', at(ended, 10, 1), []),
    bareFresh: await account('learner', at(current, 8, 20), []),
    staff: await account('staff', at(ended, 9, 1), [at(ended, 9, 1)]),
  };
  return {
    db,
    ended,
    current,
    contentId: content.id,
    course,
    accounts,
    runsAt: new Date(Date.UTC(current, 7, 30, 22)),
    close: async () => {
      await clearPurgeYears(db, current);
      await db.ltiPlatform.deleteMany({ where: { id: platform.id } });
      await db.h5PContent.deleteMany({ where: { id: content.id } });
      await db.user.deleteMany({ where: { id: { in: [owner.id, ...Object.values(accounts)] } } });
      await db.$disconnect();
    },
  };
}
