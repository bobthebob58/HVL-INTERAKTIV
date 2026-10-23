/**
 * Integration tests for ltijs's storage on PostgreSQL: the shared contract, atomic nonces, record lifetimes, the
 * claim allowlist on the stored row, and the deployment check before an ID token is stored.
 *
 * Spec: LTI-002, LTI-001, DATA-002
 */
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../../src/generated/prisma/client.js';
import { isAuthError } from '../../../src/http/authErrors.js';
import { PrismaLtiDatabaseManager } from '../../../src/lti/storage/PrismaLtiDatabaseManager.js';
import { ID_TOKEN_LIFETIME_MS, NONCE_LIFETIME_MS } from '../../../src/lti/storage/ltiRecordLifetimes.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { describeLtiDatabaseContract } from './ltiDatabaseContract.js';
import { canvasLaunchClaims, PERSONAL_VALUES, storedLaunchClaims } from './ltiLaunchClaims.js';
import { createLtiStorageTestbed } from './ltiStorageTestbed.js';

const clockAt = (start: number) => (offsetMs: number) => () => new Date(start + offsetMs);

describeWithServices('[LTI-002] PrismaLtiDatabaseManager on PostgreSQL', () => {
  const bed = createLtiStorageTestbed();
  afterAll(() => bed.close());

  const launchFor = async (deploymentIds: readonly string[], deploymentId = 'deployment-1') => {
    const platform = await bed.createPlatform(deploymentIds);
    const input = { iss: platform.url, clientId: platform.clientId, platformId: platform.id, deploymentId };
    return { platform, input, sub: randomUUID() };
  };
  const rowsWithSub = (sub: string) =>
    bed.db.ltiIdToken.count({ where: { claims: { path: ['sub'], equals: sub } } });

  describe('the shared DatabaseManager contract', () => {
    describeLtiDatabaseContract(() => ({
      database: bed.storage(),
      uniqueUrl: bed.uniqueUrl,
      allowDeployment: bed.allowDeployment,
    }));
  });

  it('[LTI-002] of 50 concurrent consumeNonce calls for one nonce, exactly one succeeds', async () => {
    // Arrange
    const storage = bed.storage();
    const nonce = randomUUID();
    await storage.saveNonce(nonce);
    // Act
    const results = await Promise.all(Array.from({ length: 50 }, () => storage.consumeNonce(nonce)));
    // Assert
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('[LTI-002] consumeNonce is one conditional DELETE statement and nothing else', async () => {
    // Arrange: a client that reports every SQL statement it sends
    const logged = new PrismaClient({
      adapter: new PrismaPg({ connectionString: serviceEnv().DATABASE_URL }),
      log: [{ emit: 'event', level: 'query' }],
    });
    const statements: string[] = [];
    logged.$on('query', (event) => void statements.push(event.query));
    const storage = new PrismaLtiDatabaseManager({
      db: logged,
      encryption: bed.encryption,
      deployments: bed.guard,
    });
    const nonce = randomUUID();
    await storage.saveNonce(nonce);
    statements.length = 0;
    // Act
    const consumed = await storage.consumeNonce(nonce);
    await logged.$disconnect();
    // Assert
    expect(consumed).toBe(true);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(
      /^DELETE FROM "public"\."LtiNonce" WHERE .*"nonce" = \$1 AND .*"createdAt" > \$2/,
    );
  });

  it('[LTI-002] accepts a nonce for 10 minutes and refuses it from then on', async () => {
    // Arrange
    const at = clockAt(Date.now());
    const [fresh, stale] = [randomUUID(), randomUUID()];
    bed.forgetNonce(stale);
    await bed.storage({ now: at(0) }).saveNonce(fresh);
    await bed.storage({ now: at(0) }).saveNonce(stale);
    // Act
    const lastMoment = await bed.storage({ now: at(NONCE_LIFETIME_MS - 1) }).consumeNonce(fresh);
    const tooLate = await bed.storage({ now: at(NONCE_LIFETIME_MS) }).consumeNonce(stale);
    // Assert
    expect({ lastMoment, tooLate }).toEqual({ lastMoment: true, tooLate: false });
  });

  it('[LTI-002] returns an ID token for 24 hours, and its row records that expiry', async () => {
    // Arrange
    const at = clockAt(Date.now());
    const { input } = await launchFor(['deployment-1']);
    // Act
    const id = await bed.storage({ now: at(0) }).saveIdToken(canvasLaunchClaims(input));
    const row = await bed.db.ltiIdToken.findUniqueOrThrow({ where: { id } });
    // Assert
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(ID_TOKEN_LIFETIME_MS);
    expect(ID_TOKEN_LIFETIME_MS).toBe(24 * 60 * 60 * 1000);
    expect(await bed.storage({ now: at(ID_TOKEN_LIFETIME_MS - 1) }).getIdToken(id)).toMatchObject({ id });
    expect(await bed.storage({ now: at(ID_TOKEN_LIFETIME_MS) }).getIdToken(id)).toBeUndefined();
  });

  it('[DATA-002] the stored row holds only the allowlisted claims, and the argument is unchanged', async () => {
    // Arrange
    const { input, sub } = await launchFor(['deployment-1']);
    const claims = canvasLaunchClaims({ ...input, sub });
    // Act
    const id = await bed.storage().saveIdToken(claims);
    const row = await bed.db.ltiIdToken.findUniqueOrThrow({ where: { id } });
    // Assert
    expect(row.claims).toEqual(storedLaunchClaims({ ...input, sub }));
    expect(PERSONAL_VALUES.filter((value) => JSON.stringify(row.claims).includes(value))).toEqual([]);
    expect(claims).toEqual(canvasLaunchClaims({ ...input, sub }));
    expect(await bed.storage().getIdToken(id)).toEqual({ ...storedLaunchClaims({ ...input, sub }), id });
  });

  it('[LTI-001] stores nothing for a deployment that is not configured for the launching platform', async () => {
    // Arrange: deployment-1 belongs to the platform; deployment-2 only to another platform
    const { input, sub } = await launchFor(['deployment-1'], 'deployment-2');
    await bed.createPlatform(['deployment-2']);
    const storage = bed.storage();
    const refusals: unknown[] = [];
    // Act
    for (const deploymentId of ['deployment-2', '', 'Deployment-1']) {
      await storage
        .saveIdToken(canvasLaunchClaims({ ...input, deploymentId, sub }))
        .catch((e) => refusals.push(e));
    }
    await storage
      .saveIdToken({ ...storedLaunchClaims({ ...input, sub }), platform_id: 'nope' })
      .catch((e) => {
        refusals.push(e);
      });
    // Assert
    expect(refusals.map((error) => isAuthError(error, 'hvl:deployment-not-allowed'))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(await rowsWithSub(sub)).toBe(0);
  });

  it('[LTI-002] treats a malformed platform ID, ID-token ID or nonce as not found, without a query error', async () => {
    // Arrange
    const storage = bed.storage();
    // Act and assert
    for (const id of ['not-a-uuid', '', '1; DROP TABLE "LtiPlatform"']) {
      expect(await storage.getPlatformById(id)).toBeUndefined();
      await expect(storage.updatePlatformById(id, { name: 'x' })).resolves.toBeUndefined();
      await expect(storage.deletePlatformById(id)).resolves.toBeUndefined();
    }
    expect(await storage.getIdToken('')).toBeUndefined();
    expect(await storage.getPlatformByUrlAndClientId('', '')).toBeUndefined();
    for (const nonce of ['', undefined, null] as unknown as string[]) {
      expect(await storage.consumeNonce(nonce)).toBe(false);
    }
  });
});
