/**
 * learnerRightsSeed — what the end-to-end test of a learner's data rights adds beside the browser's real play: the
 * HVL admin who runs the data-subject request (a staff account made as a Feide login makes it, D-055), last academic
 * year's rows of another learner in the same course (for the yearly purge), and the environment the operations CLIs
 * run with, pointed at the test's own database.
 *
 * Why: the data-subject CLI (DATA-008, D-108) and the yearly purge (DATA-003, D-107) are run by HVL operations through
 *      their npm scripts (docs/ops/), never through a page. A journey test must show them acting on what a real launch
 *      and play stored; the operator and an ended year cannot come from a browser today, so they are seeded the way
 *      ../../test/privacy/support/operationsSeed.ts seeds them.
 * Spec: DATA-008, DATA-003, DATA-007, DATA-010
 * Invariants:
 *   - The CLIs get the test bed's own keys and pseudonym secrets (from the environment that apps/server/.env filled),
 *     so they derive the learner keys a launch derived; the database is the test's fresh deployment, as `hvli_app`.
 *   - The ended year's rows are about a random learner key that no launch derives, so no request can reach them; they
 *     are hand-counted: 2 statements and 1 state.
 *   - PRIVACY: nothing here prints or stores a Feide ID or `sub` beyond the seeded identity's keyed hash.
 * Collaborators: ../../test/support/freshDeployment.ts, ../../test/support/serverCli.ts,
 *   ../learnerDataRights.e2e.test.ts.
 * Tests: apps/server/e2e/learnerDataRights.e2e.test.ts
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { identitySource } from '../../src/auth/identity/subjectSources.js';
import type { Database } from '../../src/infra/prismaClient.js';
import { academicYearOf } from '../../src/privacy/academicYear.js';
import { IdentityHasher } from '../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../src/security/keys/keyring.js';

/** The variables the CLIs take from the test's own environment, as apps/server/.env gave them. */
const SHARED = [
  'REDIS_URL',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'PSEUDONYM_SECRETS',
  'FEIDE_CLIENT_ID',
  'FEIDE_CLIENT_SECRET',
  'IDENTITY_HASH_KEYS',
  'DATA_ENCRYPTION_KEYS',
  'URL_SIGNING_KEYS',
] as const;

/**
 * The operations CLIs' environment.
 * @param appUrl - The fresh deployment's `hvli_app` URL.
 * @param operatorFeideId - The admin who runs the requests (`ADMIN_FEIDE_IDS`).
 * @returns The variables, as a runbook sets them.
 */
export function operationsEnv(appUrl: string, operatorFeideId: string): Record<string, string> {
  const shared = Object.fromEntries(SHARED.map((name) => [name, process.env[name] ?? '']));
  return {
    ...shared,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: appUrl,
    ADMIN_FEIDE_IDS: operatorFeideId,
    MIN_GROUP_SIZE: '5',
  };
}

/**
 * An HVL admin's staff account with its Feide identity, as a Feide login creates them.
 * @param db - The test's database.
 * @returns The admin's Feide ID, for `--operator`.
 */
export async function seedOperator(db: Database): Promise<string> {
  const feideId = `ops-${randomUUID().slice(0, 8)}@hvl.no`;
  const hasher = new IdentityHasher(parseKeyring(process.env.IDENTITY_HASH_KEYS ?? ''));
  const { hash, keyId } = hasher.hash('identity-subject', identitySource({ kind: 'feide', feideId }));
  const user = await db.user.create({ data: { kind: 'staff' } });
  await db.identity.create({
    data: { userId: user.id, provider: 'feide', subjectHash: hash, subjectKeyId: keyId },
  });
  return feideId;
}

/**
 * Last academic year's rows of another learner of the course: an `attempted` and an `answered`, and a saved state.
 * @param db - The test's database.
 * @param contentId - The activity.
 * @param contextId - The platform-scoped course (`<platformId>:<contextId>`, D-103).
 * @param now - The moment of the run.
 * @returns The learner key and the ended year.
 */
export async function seedEndedYear(
  db: Database,
  contentId: string,
  contextId: string,
  now: Date,
): Promise<{ learnerKey: string; ended: number }> {
  const ended = academicYearOf(now) - 1;
  const timestamp = new Date(Date.UTC(ended, 9, 1, 10));
  const learnerKey = randomBytes(32).toString('hex');
  await db.xapiStatement.createMany({
    data: ['attempted', 'answered'].map((verb) => ({
      contentId,
      contentVersion: 1,
      contextId,
      learnerKey,
      verb,
      scoreRaw: verb === 'answered' ? 1 : null,
      scoreMax: verb === 'answered' ? 1 : null,
      attemptId: `${randomUUID()}:1`,
      timestamp,
      academicYear: ended,
    })),
  });
  await db.h5PUserData.create({
    data: { contentId, dataType: 'state', learnerKey, data: '{"answers":[0]}', academicYear: ended },
  });
  return { learnerKey, ended };
}
