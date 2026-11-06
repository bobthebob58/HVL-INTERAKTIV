/**
 * operationsSeed — the rows the operations CLIs work on in a fresh deployment, written as the app role: an HVL admin
 * who runs the data-subject requests, and two learners (Kari and Ola) with statements, states and a grade job in the
 * academic year that ended and in the current one; plus the environment the CLIs run with.
 *
 * Why: the yearly purge (DATA-003, D-107) and the data-subject CLI (DATA-008, D-108) must be shown working together on
 *      one database, through their npm scripts, with keys derived as a login derives them. Writing the rows as
 *      `hvli_app` also shows that the app role may write every table they use (DATA-010).
 * Spec: DATA-003, DATA-008, DATA-010
 * Invariants:
 *   - Keys come from `deriveLearnerKey` at a moment in each year, with secrets made here, as a portal login makes them.
 *   - Ola's account and identity were created in the ended year (the purge takes them); Kari's in the current year
 *     (they stay until her erasure).
 *   - Hand-counted, per learner and year: 2 statements and 1 state; and 1 grade job of Kari's in the ended year.
 * Collaborators: ../operationsClis.int.test.ts, ../../support/freshDeployment.ts.
 * Tests: apps/server/test/privacy/operationsClis.int.test.ts
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { identitySource } from '../../../src/auth/identity/subjectSources.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import { academicYearOf } from '../../../src/privacy/academicYear.js';
import { deriveLearnerKey } from '../../../src/privacy/deriveLearnerKey.js';
import { parsePseudonymSecrets } from '../../../src/privacy/pseudonymSecrets.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';
import { serviceEnv } from '../../support/services.js';

/** One learner: the Feide ID a request names, and the keys of the ended and the current year. */
export interface SeededLearner {
  readonly feideId: string;
  readonly userId: string;
  readonly keys: { readonly ended: string; readonly current: string };
}

/** What the seed wrote, and how the CLIs run. */
export interface OperationsSeed {
  readonly ended: number;
  readonly current: number;
  /** The CLIs' environment, connected as `hvli_app`. */
  readonly env: Readonly<Record<string, string>>;
  readonly operatorFeideId: string;
  readonly kari: SeededLearner;
  readonly ola: SeededLearner;
}

const key32 = (): string => randomBytes(32).toString('base64');

/**
 * Writes the rows as the app role.
 * @param app - A client connected as `hvli_app`.
 * @param appUrl - Its connection URL, for the CLIs.
 * @param now - The moment of the run.
 * @returns The seed.
 */
export async function seedOperations(app: Database, appUrl: string, now: Date): Promise<OperationsSeed> {
  const current = academicYearOf(now);
  const ended = current - 1;
  const run = randomUUID().slice(0, 8);
  const env = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: appUrl,
    REDIS_URL: serviceEnv().REDIS_URL,
    S3_ACCESS_KEY_ID: 'unused',
    S3_SECRET_ACCESS_KEY: 'unused-in-these-clis',
    PSEUDONYM_SECRETS: `${ended}=${key32()},${current}=${key32()}`,
    FEIDE_CLIENT_ID: 'unused',
    FEIDE_CLIENT_SECRET: 'unused-in-these-clis',
    IDENTITY_HASH_KEYS: `ops1=${key32()}`,
    DATA_ENCRYPTION_KEYS: `ops1=${key32()}`,
    URL_SIGNING_KEYS: `ops1=${key32()}`,
    ADMIN_FEIDE_IDS: `ops-${run}@hvl.no`,
    MIN_GROUP_SIZE: '5',
  };
  const secrets = parsePseudonymSecrets(env.PSEUDONYM_SECRETS);
  const hasher = new IdentityHasher(parseKeyring(env.IDENTITY_HASH_KEYS));
  const inEnded = (minute = 0) => new Date(Date.UTC(ended, 9, 1, 10, minute));
  const account = async (kind: 'staff' | 'learner', feideId: string, createdAt: Date) => {
    const user = await app.user.create({ data: { kind, createdAt } });
    const { hash, keyId } = hasher.hash('identity-subject', identitySource({ kind: 'feide', feideId }));
    await app.identity.create({
      data: { userId: user.id, provider: 'feide', subjectHash: hash, subjectKeyId: keyId, createdAt },
    });
    return user.id;
  };
  const operator = await account('staff', env.ADMIN_FEIDE_IDS, now);
  const content = await app.h5PContent.create({
    data: { mainLibrary: 'H5P.MultiChoice', title: 'Drift', params: {}, metadata: {}, ownerUserId: operator },
  });
  const platform = await app.ltiPlatform.create({
    data: {
      url: `https://canvas-${run}.example`,
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
  const placement = await app.ltiPlacement.create({
    data: { platformId: platform.id, contextId: 'OPS', resourceLinkId: `ops-${run}`, contentId: content.id },
  });
  const learner = async (name: string, createdAt: Date): Promise<SeededLearner> => {
    const feideId = `${name}-${run}@hvl.no`;
    const source = { kind: 'feide' as const, feideId };
    const keys = {
      ended: deriveLearnerKey(source, secrets, inEnded()),
      current: deriveLearnerKey(source, secrets, now),
    };
    for (const [academicYear, learnerKey, at] of [
      [ended, keys.ended, inEnded()],
      [current, keys.current, now],
    ] as const) {
      await app.xapiStatement.createMany({
        data: ['attempted', 'answered'].map((verb) => ({
          contentId: content.id,
          contentVersion: 1,
          contextId: `${platform.id}:OPS`,
          learnerKey,
          verb,
          scoreRaw: verb === 'answered' ? 1 : null,
          scoreMax: verb === 'answered' ? 1 : null,
          attemptId: `${randomUUID()}:1`,
          timestamp: at,
          academicYear,
        })),
      });
      await app.h5PUserData.create({
        data: { contentId: content.id, dataType: 'state', learnerKey, data: '{"answers":[0]}', academicYear },
      });
    }
    return { feideId, userId: await account('learner', feideId, createdAt), keys };
  };
  const kari = await learner('kari', now);
  const ola = await learner('ola', inEnded());
  await app.gradeSyncJob.create({
    data: {
      placementId: placement.id,
      learnerKey: kari.keys.ended,
      attemptId: `${randomUUID()}:1`,
      scoreGiven: 100,
      resultAt: inEnded(30),
      status: 'succeeded',
      idempotencyKey: randomUUID(),
      nextAttemptAt: null,
      academicYear: ended,
    },
  });
  return { ended, current, env, operatorFeideId: env.ADMIN_FEIDE_IDS, kari, ola };
}
