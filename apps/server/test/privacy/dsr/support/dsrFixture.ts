/**
 * dsrFixture — a data subject (Kari) and another learner (Ola) with rows in two academic years, an HVL admin to run
 * the requests, and the secrets and identity keys of these tests; removed by `close`.
 *
 * Why: DATA-008's Verify is an integration test of export and erasure; D-108 asks for a learner with rows in two
 *      academic years and another learner whose rows remain. Kari's rows sit under both of her pseudonym variants
 *      (Feide and Canvas) and both years, her Canvas identity under the identity ring's older key (D-055), so a
 *      request must derive every key to find them all.
 * Spec: DATA-008
 * Invariants:
 *   - The years (2040, 2041) are far from every other test's, and the secrets and keys are random per run, so no
 *     other test's rows match and no purge test's year selects these rows.
 *   - Expected rows, hand-counted (./dsrFixtureRows.ts): Kari has 3 + 2 statements (2040 in the course, 2041 in the
 *     portal), 1 + 2 states (one per variant in 2041), 1 + 1 grade jobs (only the 2040 job holds an encrypted sub), a
 *     Canvas and a Feide learner account, and one portal login event. Her Canvas account also holds an identity that
 *     no identifier given matches (another Canvas), so an erasure keeps that account (D-034). Ola has 2 + 2
 *     statements, 1 + 1 states and 1 grade job. A 2039 statement, a 2038 state and a 2037 grade job sit under years
 *     with no secret, one per table.
 * Tests: apps/server/test/privacy/dsr/dataSubjectRequest.int.test.ts,
 *   apps/server/test/privacy/dsr/dataSubjectErasure.int.test.ts, apps/server/test/privacy/dsr/dsrCli.int.test.ts
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { identitySource } from '../../../../src/auth/identity/subjectSources.js';
import { createPrismaClient, type Database } from '../../../../src/infra/prismaClient.js';
import type { DataSubject } from '../../../../src/privacy/dsr/dataSubject.js';
import type { DsrDeps } from '../../../../src/privacy/dsr/dataSubjectRequest.js';
import { IdentityHasher } from '../../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../../src/security/keys/keyring.js';
import { serviceEnv, uniqueName } from '../../../support/services.js';
import { pseudonymsAsWritten, seedLearnerRows } from './dsrFixtureRows.js';

/** The fixture's two academic years. */
export const DSR_YEARS = [2040, 2041] as const;

/** The fixture. */
export interface DsrFixture {
  readonly db: Database;
  /** What `runDataSubjectRequest` needs, with request IDs recorded in `requestIds`. */
  readonly deps: DsrDeps;
  readonly requestIds: string[];
  /** The admin's Feide ID and account. */
  readonly operator: { readonly feideId: string; readonly userId: string };
  /** Kari, as the DPO's request names her: her Feide ID and her Canvas identity. */
  readonly kari: DataSubject;
  /** Ola, the other learner. */
  readonly ola: DataSubject;
  /** Kari's learner accounts (Canvas, Feide). */
  readonly kariAccounts: readonly string[];
  /** Ola's learner account. */
  readonly olaAccount: string;
  readonly contentId: string;
  /** `<platformId>:DSR-COURSE` (D-103). */
  readonly course: string;
  /** Rows under a learner's keys, per table. */
  rowsOf(subject: DataSubject): Promise<Record<string, number>>;
  close(): Promise<void>;
}

const secret = () => randomBytes(32);

/**
 * Writes the fixture.
 * @returns The fixture.
 */
export async function openDsrFixture(): Promise<DsrFixture> {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const run = randomUUID().slice(0, 8);
  const secrets = new Map(DSR_YEARS.map((year) => [year, secret()]));
  // WHY: two identity keys, the newer first, so an identity hashed under the older key must be found too (D-055).
  const ring = parseKeyring(`new=${secret().toString('base64')},old=${secret().toString('base64')}`);
  const hasher = new IdentityHasher(ring);
  const older = new IdentityHasher(parseKeyring(`old=${ring.keys[1]?.secret.toString('base64') ?? ''}`));
  const operatorFeideId = `dsr-admin-${run}@hvl.no`;
  const issuer = `https://${uniqueName('dsr')}.example`;
  const kari: DataSubject = { feideId: `kari-${run}@hvl.no`, lti: [{ issuer, subject: `kari-sub-${run}` }] };
  const ola: DataSubject = { lti: [{ issuer, subject: `ola-sub-${run}` }] };
  const requestIds: string[] = [];

  const operator = await db.user.create({ data: { kind: 'staff', displayName: 'DSR Admin' } });
  const identity = (userId: string, provider: 'feide' | 'lti', source: string, by: IdentityHasher) => {
    const { hash, keyId } = by.hash('identity-subject', source);
    return db.identity.create({ data: { userId, provider, subjectHash: hash, subjectKeyId: keyId } });
  };
  await identity(operator.id, 'feide', identitySource({ kind: 'feide', feideId: operatorFeideId }), hasher);
  const content = await db.h5PContent.create({
    data: {
      mainLibrary: 'H5P.MultiChoice',
      title: 'DSR',
      params: {},
      metadata: {},
      ownerUserId: operator.id,
    },
  });
  const platform = await db.ltiPlatform.create({
    data: {
      url: issuer,
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
      contextId: 'DSR-COURSE',
      resourceLinkId: uniqueName('link'),
      contentId: content.id,
    },
  });
  const learner = async (provider: 'feide' | 'lti', source: string, by: IdentityHasher) => {
    const user = await db.user.create({ data: { kind: 'learner' } });
    await identity(user.id, provider, source, by);
    return user.id;
  };
  const ltiSource = (s: DataSubject) =>
    identitySource({ kind: 'lti', issuer, subject: s.lti[0]?.subject ?? '' });
  const kariCanvas = await learner('lti', ltiSource(kari), older);
  // WHY: an identity the request does not name keeps its account; only accounts left without one go (D-034).
  await identity(kariCanvas, 'lti', `lti|https://other-canvas.example|kari-${run}`, hasher);
  const kariFeide = await learner(
    'feide',
    identitySource({ kind: 'feide', feideId: kari.feideId ?? '' }),
    hasher,
  );
  const olaAccount = await learner('lti', ltiSource(ola), hasher);
  await db.authAuditEvent.create({ data: { actorUserId: kariFeide, event: 'login.feide' } });

  const keysOf = (s: DataSubject) => pseudonymsAsWritten(s, secrets, DSR_YEARS);
  const course = `${platform.id}:DSR-COURSE`;
  await seedLearnerRows(
    db,
    { contentId: content.id, course, placementId: placement.id },
    keysOf(kari),
    keysOf(ola),
  );
  const allKeys = [...keysOf(kari), ...keysOf(ola)].map((p) => p.learnerKey);
  const rowsOf = async (s: DataSubject) => {
    const where = { learnerKey: { in: keysOf(s).map((p) => p.learnerKey) } };
    return {
      xapiStatements: await db.xapiStatement.count({ where }),
      h5pUserData: await db.h5PUserData.count({ where }),
      gradeSyncJobs: await db.gradeSyncJob.count({ where }),
    };
  };
  return {
    db,
    deps: {
      db,
      secrets,
      hasher,
      adminFeideIds: [operatorFeideId, `other-admin-${run}@hvl.no`],
      now: new Date('2041-11-04T09:00:00.000Z'),
      newRequestId: () => {
        const id = randomUUID();
        requestIds.push(id);
        return id;
      },
    },
    requestIds,
    operator: { feideId: operatorFeideId, userId: operator.id },
    kari,
    ola,
    kariAccounts: [kariCanvas, kariFeide],
    olaAccount,
    contentId: content.id,
    course,
    rowsOf,
    close: async () => {
      const where = { learnerKey: { in: allKeys } };
      await db.gradeSyncJob.deleteMany({ where });
      await db.xapiStatement.deleteMany({ where: { contentId: content.id } });
      await db.h5PUserData.deleteMany({ where });
      await db.auditEvent.deleteMany({ where: { targetId: { in: requestIds } } });
      await db.authAuditEvent.deleteMany({ where: { actorUserId: kariFeide } });
      await db.ltiPlatform.deleteMany({ where: { id: platform.id } });
      await db.h5PContent.deleteMany({ where: { id: content.id } });
      await db.user.deleteMany({ where: { id: { in: [kariCanvas, kariFeide, olaAccount, operator.id] } } });
      await db.$disconnect();
    },
  };
}
