/**
 * Integration tests for the cleanup of expired ltijs records on PostgreSQL and Redis: exactly the expired rows go,
 * and with two server nodes only one cleans up in each interval.
 *
 * Spec: LTI-002, DATA-002
 */
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { createLogger } from '../../../src/logging/logger.js';
import { LTI_CLEANUP_LEASE_KEY, LtiRecordCleanupJob } from '../../../src/lti/storage/LtiRecordCleanupJob.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

const silent = createLogger({
  level: 'silent',
  destination: new Writable({ write: (_c, _e, done) => done() }),
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// WHY: a clock in 1999 makes the job touch only this file's rows; the database is shared with other tests.
const T = Date.UTC(1999, 4, 17, 12, 0, 0);
const at = (offsetMs: number) => new Date(T + offsetMs);
const MINUTE = 60_000;

describeWithServices('[LTI-002] cleanup of expired ltijs records on PostgreSQL', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  let redisA: Redis;
  let redisB: Redis;
  const url = `https://${uniqueName('cleanup')}.platform.test`;
  const ids = { expired: randomUUID(), alive: randomUUID(), old: randomUUID(), fresh: randomUUID() };

  beforeAll(async () => {
    [redisA, redisB] = await Promise.all([
      connectRedis(serviceEnv().REDIS_URL),
      connectRedis(serviceEnv().REDIS_URL),
    ]);
  });

  afterAll(async () => {
    await redisA.del(LTI_CLEANUP_LEASE_KEY);
    await db.ltiIdToken.deleteMany({ where: { id: { in: [ids.expired, ids.alive] } } });
    await db.ltiNonce.deleteMany({ where: { nonce: { in: [ids.old, ids.fresh] } } });
    await db.ltiAccessToken.deleteMany({ where: { platformUrl: url } });
    await Promise.all([redisA.quit(), redisB.quit(), db.$disconnect()]);
  });

  it('[LTI-002] deletes expired ID tokens, nonces older than 10 minutes and expired access tokens only', async () => {
    // Arrange: one row on each side of each limit, as seen from the job's clock T
    await db.ltiIdToken.createMany({
      data: [
        { id: ids.expired, claims: { iss: url }, createdAt: at(-24 * 60 * MINUTE), expiresAt: at(0) },
        { id: ids.alive, claims: { iss: url }, createdAt: at(-MINUTE), expiresAt: at(1) },
      ],
    });
    await db.ltiNonce.createMany({
      data: [
        { nonce: ids.old, createdAt: at(-10 * MINUTE) },
        { nonce: ids.fresh, createdAt: at(-10 * MINUTE + 1) },
      ],
    });
    const token = {
      clientId: 'client-a',
      platformUrl: url,
      tokenEncrypted: new Uint8Array([1]),
      createdAt: at(-MINUTE),
    };
    await db.ltiAccessToken.createMany({
      data: [
        { ...token, scopes: 'expired', expiresAt: at(0) },
        { ...token, scopes: 'alive', expiresAt: at(1) },
      ],
    });
    await redisA.del(LTI_CLEANUP_LEASE_KEY);
    const job = new LtiRecordCleanupJob({ db, redis: redisA, logger: silent, now: () => at(0) });
    // Act
    const outcome = await job.runOnce();
    // Assert
    expect(outcome).toBe('ran');
    const idTokens = await db.ltiIdToken.findMany({ where: { id: { in: [ids.expired, ids.alive] } } });
    expect(idTokens.map((row) => row.id)).toEqual([ids.alive]);
    const nonces = await db.ltiNonce.findMany({ where: { nonce: { in: [ids.old, ids.fresh] } } });
    expect(nonces.map((row) => row.nonce)).toEqual([ids.fresh]);
    const tokens = await db.ltiAccessToken.findMany({ where: { platformUrl: url } });
    expect(tokens.map((row) => row.scopes)).toEqual(['alive']);
  });

  it('[LTI-002] with two server nodes, exactly one cleans up in each interval', async () => {
    // Arrange: two nodes with their own Redis connections, counting the cleanups they actually do
    await redisA.del(LTI_CLEANUP_LEASE_KEY);
    let cleanups = 0;
    const counting = {
      ltiIdToken: { deleteMany: (args: never) => ((cleanups += 1), db.ltiIdToken.deleteMany(args)) },
      ltiNonce: db.ltiNonce,
      ltiAccessToken: db.ltiAccessToken,
    };
    const node = (redis: Redis) =>
      new LtiRecordCleanupJob({
        db: counting as never,
        redis,
        logger: silent,
        intervalMs: 300,
        now: () => at(0),
      });
    const [nodeA, nodeB] = [node(redisA), node(redisB)];
    // Act
    const firstInterval = await Promise.all([nodeA.runOnce(), nodeB.runOnce()]);
    await sleep(350);
    const secondInterval = await nodeB.runOnce();
    // Assert
    expect(firstInterval.sort()).toEqual(['ran', 'skipped']);
    expect(secondInterval).toBe('ran');
    expect(cleanups).toBe(2);
  });
});
