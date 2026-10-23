/**
 * ltijsStorageHarness — a real ltijs Provider on PrismaLtiDatabaseManager and LtiCacheManager for one `describe`
 * block, with launches from new platforms.
 *
 * Why: two test files run ltijs on our storage (the launch itself, and what a resumed launch can still do). The
 *      setup (database, Redis, Provider) and the "new platform, allowed deployment, Canvas claims" launch are the
 *      same for both, so they live here.
 * Spec: LTI-002
 * Invariants:
 *   - Registers its own `beforeAll`/`afterAll`; every platform URL comes from the testbed, which removes its rows.
 *   - `deployment-1` is the only allowed deployment of each new platform.
 * Collaborators: ./ltijsLaunchDriver.ts, ./ltiStorageTestbed.ts, ./ltiLaunchClaims.ts.
 * Tests: apps/server/test/lti/storage/ltijsOnPrismaStorage.int.test.ts,
 *   apps/server/test/lti/storage/ltijsResumedLaunch.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { LaunchContext, Platform } from 'ltijs';
import { afterAll, beforeAll } from 'vitest';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { LtiCacheManager } from '../../../src/lti/storage/LtiCacheManager.js';
import { serviceEnv } from '../../support/services.js';
import { createLtijsLaunchDriver, type DrivenLaunch, type LtijsLaunchDriver } from './ltijsLaunchDriver.js';
import { canvasLaunchClaims, type LaunchClaimsInput } from './ltiLaunchClaims.js';
import { createLtiStorageTestbed, type LtiStorageTestbed } from './ltiStorageTestbed.js';

/** One launch from a new platform. */
export interface HarnessLaunch {
  /** The platform ltijs registered. */
  readonly platform: Platform;
  /** The claims input of the launch, with its unique `sub`. */
  readonly input: LaunchClaimsInput & { readonly sub: string };
  /** The launch's redirect and replay. */
  readonly launch: DrivenLaunch;
  /** The context ltijs handed to the handler. */
  readonly context: LaunchContext;
}

/** What a test file gets from the harness. */
export interface LtijsStorageHarness {
  /** The database side. */
  readonly bed: LtiStorageTestbed;
  /** The Provider driver; available from `beforeAll` on. */
  driver(): LtijsLaunchDriver;
  /** Registers a platform through ltijs and allows its `deployment-1`. */
  platformWithDeployment(): Promise<Platform>;
  /** Launches from a new platform with Canvas's claims. */
  launchFromNewPlatform(): Promise<HarnessLaunch>;
}

/**
 * Sets up ltijs on our storage for the enclosing `describe` block.
 * @returns The harness.
 */
export function useLtijsOnPrisma(): LtijsStorageHarness {
  const bed = createLtiStorageTestbed();
  let redis: Redis;
  let driver: LtijsLaunchDriver;

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
    driver = await createLtijsLaunchDriver({
      databaseManager: bed.storage(),
      cacheManager: new LtiCacheManager(redis),
    });
  });
  afterAll(async () => {
    await redis.quit();
    await bed.close();
  });

  const platformWithDeployment = async () => {
    const platform = await driver.registerPlatform(bed.uniqueUrl());
    await bed.allowDeployment(platform.id, 'deployment-1');
    return platform;
  };

  return {
    bed,
    driver: () => driver,
    platformWithDeployment,
    async launchFromNewPlatform() {
      const platform = await platformWithDeployment();
      const input = {
        iss: platform.url,
        clientId: platform.clientId,
        platformId: platform.id,
        deploymentId: 'deployment-1',
        sub: randomUUID(),
      };
      const launch = await driver.launch(canvasLaunchClaims(input));
      return { platform, input, launch, context: driver.handled.at(-1)! };
    },
  };
}
