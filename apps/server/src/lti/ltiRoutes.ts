/**
 * ltiRoutes — assembles everything under `/lti`: ltijs's login, launch and keyset routes, the two launch handlers,
 * the player and the Deep Linking picker, and the LTI error pages.
 *
 * Why: the app mounts one router for Canvas (spec 02 LTI-001…007). The ltik resolver built here is also what the
 *      H5P and API routes use to authenticate LTI requests (../auth/requestPrincipal.ts), so the same platform,
 *      deployment and account checks run everywhere (D-050, D-051).
 * Spec: LTI-001, LTI-003, LTI-005, LTI-006, AUTH-005
 * Invariants:
 *   - ltijs's routes come first, so its login and launch see the request before anything else of ours.
 *   - Errors from any of these routes end in `ltiErrorPages` (a page, or JSON for API calls), never in ltijs's JSON.
 *   - Only the launch handlers may create LTI accounts; the resolver never writes.
 * Collaborators: ./LtiProviderFactory.ts, ./launch/onResourceLink.ts, ./launch/onDeepLinking.ts,
 *   ./play/ltiPlayRoutes.ts, ./deepLinking/deepLinkRoutes.ts, ./http/ltiErrorPages.ts, ./ltikPrincipal.ts,
 *   ../server/createApp.ts.
 * Tests: apps/server/test/lti/ltiLaunch.int.test.ts, apps/server/test/lti/deepLinking/deepLinking.int.test.ts
 */
import { Router } from 'express';
import type { Provider } from 'ltijs';
import type { Logger } from 'pino';
import type { AuthAuditRecorder } from '../auth/audit/AuthAuditRecorder.js';
import { AccountResolver } from '../auth/identity/AccountResolver.js';
import { accountLinker } from '../auth/identity/accountLinking.js';
import type { ContentAccessRepository } from '../h5p/permissions/ContentAccessRepository.js';
import type { H5pRouteDeps } from '../http/h5pRouteDeps.js';
import type { Database } from '../infra/prismaClient.js';
import type { Redis } from '../infra/redisClient.js';
import type { PseudonymSecrets } from '../privacy/pseudonymSecrets.js';
import type { DataEncryption } from '../security/keys/DataEncryption.js';
import type { IdentityHasher } from '../security/keys/IdentityHasher.js';
import { deepLinkRoutes } from './deepLinking/deepLinkRoutes.js';
import { ltiErrorPages } from './http/ltiErrorPages.js';
import { LtiAccounts } from './launch/ltiAccount.js';
import { onDeepLinking } from './launch/onDeepLinking.js';
import { onResourceLink } from './launch/onResourceLink.js';
import { resolveLtik, type ResolvedLtik } from './ltikPrincipal.js';
import { createLtiProvider } from './LtiProviderFactory.js';
import { LtiPlacementRecorder } from './placements/LtiPlacementRecorder.js';
import type { LtiDeploymentGuard } from './platforms/LtiDeploymentGuard.js';
import { ltiPlayRoutes } from './play/ltiPlayRoutes.js';

/** What the LTI routes need. */
export interface LtiRouteDeps {
  readonly db: Database;
  readonly redis: Redis;
  readonly logger: Logger;
  readonly hasher: IdentityHasher;
  readonly encryption: DataEncryption;
  /** `PSEUDONYM_SECRETS`, for the learnerKey. */
  readonly secrets: PseudonymSecrets;
  readonly audit: AuthAuditRecorder;
  /** Activity facts for the launch's View check. */
  readonly access: ContentAccessRepository;
  /** The H5P player. */
  readonly player: H5pRouteDeps['player'];
  /** `CANVAS_ORIGINS`. */
  readonly canvasOrigins: readonly string[];
  /** `LTI_TOKEN_MAX_AGE_SECONDS`. */
  readonly tokenMaxAgeSeconds: number;
  /** `PUBLIC_BASE_URL`. */
  readonly publicBaseUrl: string;
}

/** The LTI router and what the rest of the app shares with it. */
export interface LtiRoutes {
  /** Mount at `/`. */
  readonly router: Router;
  /** Resolves an ltik into the principal of its launch (for `requestPrincipal`). */
  readonly resolveLtik: (ltik: string) => Promise<ResolvedLtik>;
  /** The ltijs provider (platform registration at start-up). */
  readonly provider: Provider;
  /** The deployment check. */
  readonly deployments: LtiDeploymentGuard;
}

/**
 * Builds the LTI routes.
 * @param deps - Clients, keys, audit, the H5P player and the LTI settings.
 * @returns The router, the ltik resolver, the provider and the deployment guard.
 */
export function createLtiRoutes(deps: LtiRouteDeps): LtiRoutes {
  const { db, canvasOrigins } = deps;
  const {
    provider,
    router: ltijsRouter,
    deployments,
  } = createLtiProvider({
    db,
    redis: deps.redis,
    encryption: deps.encryption,
    logger: deps.logger,
    canvasOrigins,
    tokenMaxAgeSeconds: deps.tokenMaxAgeSeconds,
  });
  const accounts = new LtiAccounts({
    accounts: new AccountResolver({ db, hasher: deps.hasher }),
    secrets: deps.secrets,
  });
  provider.onResourceLink(
    onResourceLink({
      accounts,
      access: deps.access,
      placements: new LtiPlacementRecorder(db),
      audit: deps.audit,
    }),
  );
  provider.onDeepLinking(
    onDeepLinking({
      accounts,
      audit: deps.audit,
      link: accountLinker({ db, hasher: deps.hasher, audit: deps.audit }),
    }),
  );
  const resolve = (ltik: string): Promise<ResolvedLtik> =>
    resolveLtik({ provider, deployments, accounts }, ltik);
  const router = Router();
  router.use(ltijsRouter);
  router.use(ltiPlayRoutes({ player: deps.player, resolveLtik: resolve, canvasOrigins }));
  router.use(deepLinkRoutes({ db, resolveLtik: resolve, canvasOrigins, publicBaseUrl: deps.publicBaseUrl }));
  router.use(ltiErrorPages({ canvasOrigins, logger: deps.logger, audit: deps.audit }));
  return { router, resolveLtik: resolve, provider, deployments };
}
