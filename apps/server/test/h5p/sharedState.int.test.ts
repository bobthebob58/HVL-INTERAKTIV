/**
 * Integration tests for state shared between server nodes: settings cache, locks, cleanup job, libraries.
 *
 * Spec: H5P-004
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import type { S3Client } from '@aws-sdk/client-s3';
import { createH5pConfig } from '../../src/h5p/H5pConfigFactory.js';
import { createH5pStorage, type H5pStorage } from '../../src/h5p/h5pStorage.js';
import { TemporaryFileCleanupJob, CLEANUP_LEASE_KEY } from '../../src/h5p/jobs/TemporaryFileCleanupJob.js';
import { RedisKeyValueStorage } from '../../src/h5p/storage/RedisKeyValueStorage.js';
import { createPrismaClient } from '../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { createLogger } from '../../src/logging/logger.js';
import { describeWithServices, serviceEnv, uniqueName } from '../support/services.js';
import { createTestBucket, removeTestBucket } from '../support/storageFixtures.js';

const silent = createLogger({
  level: 'silent',
  destination: new Writable({ write: (_c, _e, done) => done() }),
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describeWithServices('[H5P-004] state shared by several server nodes', () => {
  const env = serviceEnv();
  const db = createPrismaClient(env.DATABASE_URL);
  const libraryDir = mkdtempSync(join(tmpdir(), 'h5p-libs-'));
  let redisA: Redis;
  let redisB: Redis;
  let s3: S3Client;
  let bucket: string;
  let nodeA: H5pStorage;
  let nodeB: H5pStorage;

  beforeAll(async () => {
    [redisA, redisB] = await Promise.all([connectRedis(env.REDIS_URL), connectRedis(env.REDIS_URL)]);
    ({ s3, bucket } = await createTestBucket('shared'));
    const deps = { env: { S3_CONTENT_BUCKET: bucket, S3_TEMPORARY_BUCKET: bucket }, db, s3, libraryDir };
    nodeA = createH5pStorage({ ...deps, redis: redisA });
    nodeB = createH5pStorage({ ...deps, redis: redisB });
  });

  afterAll(async () => {
    await redisA.del(CLEANUP_LEASE_KEY);
    await Promise.all([redisA.quit(), redisB.quit(), db.$disconnect()]);
    await removeTestBucket(s3, bucket);
    rmSync(libraryDir, { recursive: true, force: true });
  });

  it('[H5P-004] two nodes share H5P settings such as the Hub site UUID', async () => {
    const key = uniqueName('setting');
    await nodeA.keyValueStorage.save(key, { uuid: 'abc', list: [1, 2] });
    expect(await nodeB.keyValueStorage.load(key)).toEqual({ uuid: 'abc', list: [1, 2] });
    expect(await nodeB.keyValueStorage.load(uniqueName('missing'))).toBeUndefined();
    await nodeA.keyValueStorage.save(key, undefined);
    expect(await nodeB.keyValueStorage.load(key)).toBeUndefined();
  });

  it('[H5P-004] a config saved on one node is loaded by the other', async () => {
    // Arrange
    // WHY: a private prefix keeps this test's settings out of the development installation's settings.
    const prefix = `${uniqueName('kv')}:`;
    const configA = await createH5pConfig(new RedisKeyValueStorage(redisA, prefix), {
      platformVersion: 'test',
    });
    configA.contentTypeCacheRefreshInterval = 123_456;
    // Act: node A saves, node B loads
    await configA.save();
    const configB = await createH5pConfig(new RedisKeyValueStorage(redisB, prefix), {
      platformVersion: 'test',
    });
    // Assert
    expect(configB.contentTypeCacheRefreshInterval).toBe(123_456);
    // Clean up: remove this test's keys
    const keys = await redisA.keys(`${prefix}*`);
    if (keys.length > 0) await redisA.del(keys);
  });

  it('[H5P-004] locks are exclusive across nodes', async () => {
    // Arrange: work that records when it starts and ends
    const key = uniqueName('lock');
    const order: string[] = [];
    const work = (name: string) => async () => {
      order.push(`${name}:start`);
      await sleep(100);
      order.push(`${name}:end`);
    };
    const options = { timeout: 5_000, maxOccupationTime: 5_000 };
    // Act: both nodes take the same lock at once
    await Promise.all([
      nodeA.lockProvider.acquire(key, work('a'), options),
      nodeB.lockProvider.acquire(key, work('b'), options),
    ]);
    // Assert: whoever started first also ended before the other started
    expect(order[1]).toBe(`${order[0]?.split(':')[0]}:end`);
  });

  it('[H5P-004] the temporary file cleanup runs once per interval across nodes', async () => {
    await redisA.del(CLEANUP_LEASE_KEY);
    let runs = 0;
    const cleanUp = async () => void (runs += 1);
    const jobA = new TemporaryFileCleanupJob({ redis: redisA, cleanUp, logger: silent, intervalMs: 300 });
    const jobB = new TemporaryFileCleanupJob({ redis: redisB, cleanUp, logger: silent, intervalMs: 300 });
    const first = await Promise.all([jobA.runOnce(), jobB.runOnce()]);
    expect(first.sort()).toEqual(['ran', 'skipped']);
    await sleep(350);
    expect(await jobB.runOnce()).toBe('ran');
    expect(runs).toBe(2);
  });

  it('[H5P-004] library storage reads the shared library folder', async () => {
    expect(await nodeA.libraryStorage.getInstalledLibraryNames()).toEqual([]);
  });
});
