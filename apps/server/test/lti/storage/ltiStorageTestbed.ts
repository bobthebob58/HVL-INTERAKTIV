/**
 * ltiStorageTestbed — the PostgreSQL side of the LTI storage integration tests: one Prisma client, the
 * encryption of `DATA_ENCRYPTION_KEYS`, storages with any clock or key ring, and uniquely named platforms that
 * are removed afterwards.
 *
 * Why: these tests share one database with every other test file, and other workstreams run theirs at the same
 *      time. Each test therefore makes its own platform URLs and removes exactly the rows that carry them, and
 *      never lists or deletes rows by anything broader.
 * Spec: LTI-002
 * Invariants:
 *   - Every URL from `uniqueUrl` is new (`https://<uniqueName>.platform.test`). `close` deletes the platforms
 *     (their deployments cascade), access tokens and ID tokens (by `iss`) of those URLs and the nonces passed to
 *     `forgetNonce`, then disconnects.
 *   - Platforms get a real tool key pair (./ltiPlatformFixtures.ts), so ltijs can sign with them.
 * Collaborators: ../../support/services.ts, ./ltiPlatformFixtures.ts, ../../../src/lti/storage/PrismaLtiDatabaseManager.ts,
 *   ../../../src/lti/platforms/LtiDeploymentGuard.ts.
 * Tests: apps/server/test/lti/storage/PrismaLtiDatabaseManager.int.test.ts,
 *   apps/server/test/lti/storage/ltiSecretsAtRest.int.test.ts,
 *   apps/server/test/lti/storage/ltijsOnPrismaStorage.int.test.ts
 */
import type { PlatformRecord } from 'ltijs';
import { createPrismaClient, type Database } from '../../../src/infra/prismaClient.js';
import { LtiDeploymentGuard } from '../../../src/lti/platforms/LtiDeploymentGuard.js';
import { PrismaLtiDatabaseManager } from '../../../src/lti/storage/PrismaLtiDatabaseManager.js';
import { DataEncryption } from '../../../src/security/keys/DataEncryption.js';
import { serviceEnv, uniqueName } from '../../support/services.js';
import { platformAttributes } from './ltiPlatformFixtures.js';

/** Options of a storage made by the testbed. */
export interface TestStorageOptions {
  /** The storage's clock; defaults to the system clock. */
  readonly now?: () => Date;
  /** Another key ring; defaults to `DATA_ENCRYPTION_KEYS`. */
  readonly encryption?: DataEncryption;
}

/** What the LTI storage integration tests share. */
export interface LtiStorageTestbed {
  /** The Prisma client. */
  readonly db: Database;
  /** `DATA_ENCRYPTION_KEYS` from the environment. */
  readonly encryption: DataEncryption;
  /** The deployment guard on `db`. */
  readonly guard: LtiDeploymentGuard;
  /** Makes a storage on `db`. */
  storage(options?: TestStorageOptions): PrismaLtiDatabaseManager;
  /** A platform URL no other test uses; its rows are removed by `close`. */
  uniqueUrl(): string;
  /** Allows a deployment of a platform (an `LtiDeployment` row). */
  allowDeployment(platformId: string, deploymentId: string): Promise<void>;
  /** Saves a platform at a new URL and allows the given deployments. */
  createPlatform(deploymentIds?: readonly string[]): Promise<PlatformRecord>;
  /** Remembers a nonce that `close` must delete. */
  forgetNonce(nonce: string): void;
  /** Deletes the testbed's rows and disconnects. */
  close(): Promise<void>;
}

/**
 * Creates the testbed; call `close` in `afterAll`.
 * @returns The testbed.
 */
export function createLtiStorageTestbed(): LtiStorageTestbed {
  const env = serviceEnv();
  const db = createPrismaClient(env.DATABASE_URL);
  const encryption = new DataEncryption(env.DATA_ENCRYPTION_KEYS);
  const guard = new LtiDeploymentGuard(db);
  const urls: string[] = [];
  const nonces: string[] = [];
  const storage = (options: TestStorageOptions = {}) =>
    new PrismaLtiDatabaseManager({
      db,
      deployments: guard,
      encryption: options.encryption ?? encryption,
      now: options.now,
    });
  const uniqueUrl = () => urls[urls.push(`https://${uniqueName('lti')}.platform.test`) - 1]!;
  const allowDeployment = async (platformId: string, deploymentId: string) => {
    await db.ltiDeployment.create({ data: { platformId, deploymentId } });
  };
  return {
    db,
    encryption,
    guard,
    storage,
    uniqueUrl,
    allowDeployment,
    async createPlatform(deploymentIds = []) {
      const id = await storage().savePlatform(platformAttributes(uniqueUrl()));
      for (const deploymentId of deploymentIds) await allowDeployment(id, deploymentId);
      return (await storage().getPlatformById(id))!;
    },
    forgetNonce: (nonce) => void nonces.push(nonce),
    async close() {
      const byIssuer = urls.map((url) => ({ claims: { path: ['iss'], equals: url } }));
      await db.ltiIdToken.deleteMany({ where: { OR: byIssuer } });
      await db.ltiAccessToken.deleteMany({ where: { platformUrl: { in: urls } } });
      await db.ltiPlatform.deleteMany({ where: { url: { in: urls } } });
      await db.ltiNonce.deleteMany({ where: { nonce: { in: nonces } } });
      await db.$disconnect();
    },
  };
}
