/**
 * LtiProviderFactory — builds the ltijs 7 `Provider` with our router, storage, cache and logger.
 *
 * Why: LTI-001 asks for ltijs 7 with `/lti/login`, `/lti/launch` and `/lti/keys`, our `PrismaLtiDatabaseManager`
 *      and a Redis cache. D-050 keeps ltijs inside our app: our router (no ltijs Express app, no `listen()`), our
 *      node-redis cache, our logger, and our pages for an unknown or inactive platform.
 * Spec: LTI-001, LTI-002, LTI-003
 * Invariants:
 *   - `Provider.listen()`, `deploy()` and `platformManager.deletePlatform` are never called (D-050, D-051).
 *   - Launch tokens older than `LTI_TOKEN_MAX_AGE_SECONDS` are refused (ltijs `tokenMaxAge`).
 *   - An unknown or deactivated platform reaches our LTI error pages, never ltijs's JSON answers.
 *   - ltijs asks a platform only through our request handler: the platforms' own origins, no redirects, a time
 *     and a size limit (./http/LtiOutboundRequests.ts); and its routes sit behind the request ceiling and the
 *     own-page rule for the last step of a launch (./http/launchRequestCeiling.ts, ./http/launchPostOrigin.ts,
 *     D-141).
 * Collaborators: ./http/ExpressRouterHttpHandler.ts, ./http/LtiOutboundRequests.ts,
 *   ./http/launchRequestCeiling.ts, ./storage/PrismaLtiDatabaseManager.ts, ./storage/LtiCacheManager.ts,
 *   ./ltijsLogger.ts, ./platforms/LtiDeploymentGuard.ts, ./ltiRoutes.ts.
 * Tests: apps/server/test/lti/ltiLaunch.int.test.ts
 */
import type { Router } from 'express';
import { LtijsError, Provider } from 'ltijs';
import type { Logger } from 'pino';
import type { LtiPlatformConfig } from '../config/envParsers.js';
import type { Database } from '../infra/prismaClient.js';
import type { Redis } from '../infra/redisClient.js';
import type { DataEncryption } from '../security/keys/DataEncryption.js';
import type { IdentityHasher } from '../security/keys/IdentityHasher.js';
import { ExpressRouterHttpHandler } from './http/ExpressRouterHttpHandler.js';
import { launchRequestCeiling } from './http/launchRequestCeiling.js';
import { allowedLtiOrigins, LtiOutboundRequests } from './http/LtiOutboundRequests.js';
import { ltijsLogger } from './ltijsLogger.js';
import { LtiDeploymentGuard } from './platforms/LtiDeploymentGuard.js';
import { LtiCacheManager } from './storage/LtiCacheManager.js';
import { PrismaLtiDatabaseManager } from './storage/PrismaLtiDatabaseManager.js';

/** The LTI routes ltijs serves (spec 02 LTI-001). */
export const LTI_ROUTES = Object.freeze({
  loginRoute: '/lti/login',
  launchRoute: '/lti/launch',
  keysetRoute: '/lti/keys',
});

/** What building the provider needs. */
export interface LtiProviderDeps {
  readonly db: Database;
  readonly redis: Redis;
  readonly encryption: DataEncryption;
  readonly logger: Logger;
  /** `CANVAS_ORIGINS`, for `frame-ancestors`. */
  readonly canvasOrigins: readonly string[];
  /** `LTI_TOKEN_MAX_AGE_SECONDS`. */
  readonly tokenMaxAgeSeconds: number;
  /** `PUBLIC_BASE_URL`: the origin the last step of a launch must come from. */
  readonly publicBaseUrl: string;
  /** `LTI_PLATFORMS`: the platforms whose origins ltijs may ask. */
  readonly platforms: readonly LtiPlatformConfig[];
  /** Makes the address fingerprint the request ceiling counts under. */
  readonly hasher: Pick<IdentityHasher, 'hash'>;
  /** Production: ltijs asks platforms over https only. */
  readonly requireHttps?: boolean;
}

/** The provider and what the rest of the app needs from it. */
export interface LtiProviderParts {
  /** The ltijs provider; register `onResourceLink` and `onDeepLinking` on it. */
  readonly provider: Provider;
  /** ltijs's routes; mount at `/`. */
  readonly router: Router;
  /** The deployment check, also used on every ltik (D-051). */
  readonly deployments: LtiDeploymentGuard;
}

/**
 * Builds the ltijs provider.
 * @param deps - Database, Redis, encryption, logger, Canvas origins, the platforms, our base URL and token age.
 * @returns The provider, its router and the deployment guard.
 */
export function createLtiProvider(deps: LtiProviderDeps): LtiProviderParts {
  const { redis, hasher, logger } = deps;
  const http = new ExpressRouterHttpHandler(deps.canvasOrigins, {
    route: LTI_ROUTES.launchRoute,
    ownOrigin: new URL(deps.publicBaseUrl).origin,
    before: launchRequestCeiling({ redis, hasher, logger }),
  });
  const deployments = new LtiDeploymentGuard(deps.db);
  const provider = new Provider({
    databaseManager: new PrismaLtiDatabaseManager({ db: deps.db, encryption: deps.encryption, deployments }),
    httpHandler: http,
    // SECURITY: ltijs's default handler follows redirects and has neither a time nor a size limit (D-141).
    requestHandler: new LtiOutboundRequests({
      origins: allowedLtiOrigins(deps.platforms, deps.canvasOrigins),
      ...(deps.requireHttps ? { requireHttps: true } : {}),
    }),
    cacheManager: new LtiCacheManager(deps.redis),
    logger: ltijsLogger(deps.logger),
    routes: LTI_ROUTES,
    tokenMaxAge: deps.tokenMaxAgeSeconds,
  });
  // WHY: thrown, so ExpressRouterHttpHandler passes them to our LTI error pages (./http/ltiErrorPages.ts).
  provider.onUnregisteredPlatform(async () => {
    throw new LtijsError('UNREGISTERED_PLATFORM');
  });
  provider.onInactivePlatform(async () => {
    throw new LtijsError('PLATFORM_NOT_ACTIVATED');
  });
  return { provider, router: http.router, deployments };
}
