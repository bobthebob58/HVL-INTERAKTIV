/**
 * createApp — builds the Express app: health check, portal session, LTI, Feide login, the sharing API, the H5P
 * routes and the fallback pages, in the order the security rules need.
 *
 * Why: spec 02 joins two entry points (Canvas via LTI, the portal via Feide) into one principal; the mount order
 *      decides which checks a request meets. The app is built from connected clients so tests and `main.ts` run the
 *      same code.
 * Spec: AUTH-001, AUTH-003, LTI-001, LTI-003, H5P-007, PROD-006, NFR-002
 * Invariants:
 *   - Order: trust proxy → base headers → `/healthz` → portal session → LTI (ltijs first) → Feide routes → start
 *     page → `/api` → `/h5p` → HTML 404 → last-resort error page.
 *   - `/api` and `/h5p` authenticate with `requestPrincipal` (ltik as Bearer or an allowed query, else the portal
 *     session with CSRF); signed file URLs are checked before it, inside the H5P router (D-058).
 *   - `X-Powered-By` is off; every response gets `nosniff` and `no-referrer`, and HSTS when the base URL is https.
 * Collaborators: ../lti/ltiRoutes.ts, ../auth/feide/feideLoginRoutes.ts, ../auth/requestPrincipal.ts,
 *   ../http/createH5pRouter.ts, ../http/h5pAuthenticate.ts, ../http/api/contentSharingRoutes.ts,
 *   ./healthRoutes.ts, ./main.ts.
 * Tests: apps/server/test/server/createApp.int.test.ts
 */
import express, { type ErrorRequestHandler, type Express } from 'express';
import type { Logger } from 'pino';
import { AuthAuditRecorder } from '../auth/audit/AuthAuditRecorder.js';
import { FeideClient } from '../auth/feide/FeideClient.js';
import { feideLoginRoutes } from '../auth/feide/feideLoginRoutes.js';
import { LoginTransactions } from '../auth/feide/loginTransactions.js';
import { AccountResolver } from '../auth/identity/AccountResolver.js';
import { requestPrincipal } from '../auth/requestPrincipal.js';
import { portalSessionMiddleware } from '../auth/session/portalSessionMiddleware.js';
import { SessionStore } from '../auth/session/SessionStore.js';
import type { Env } from '../config/env.js';
import type { H5pRouteDeps } from '../http/h5pRouteDeps.js';
import { PrismaContentAccessRepository } from '../h5p/permissions/ContentAccessRepository.js';
import { contentSharingRoutes } from '../http/api/contentSharingRoutes.js';
import { createH5pRouter } from '../http/createH5pRouter.js';
import { h5pAuthenticate } from '../http/h5pAuthenticate.js';
import { h5pErrorHandler } from '../http/h5pErrorHandler.js';
import { HttpError } from '../http/HttpError.js';
import { portalHomeRoutes, portalNotFound } from '../http/pages/portalHomeRoutes.js';
import { sendPortalError } from '../http/pages/portalPages.js';
import { baseSecurityHeaders } from '../http/securityHeaders.js';
import type { Database } from '../infra/prismaClient.js';
import type { Redis } from '../infra/redisClient.js';
import { createLtiRoutes, type LtiRoutes } from '../lti/ltiRoutes.js';
import { DataEncryption } from '../security/keys/DataEncryption.js';
import { IdentityHasher } from '../security/keys/IdentityHasher.js';
import { healthRoutes } from './healthRoutes.js';

/** What the app is built from. */
export interface AppInputs {
  readonly env: Env;
  readonly logger: Logger;
  readonly db: Database;
  readonly redis: Redis;
  /** The H5P engine (../h5p/createH5pRuntime.ts). */
  readonly h5p: H5pRouteDeps;
}

/** The app and the parts `main.ts` needs at start-up. */
export interface App {
  readonly app: Express;
  readonly lti: LtiRoutes;
}

/**
 * Builds the app.
 * @param inputs - Configuration, logger, connected clients and the H5P engine.
 * @returns The Express app and the LTI parts.
 */
export function createApp(inputs: AppInputs): App {
  const { env, logger, db, redis } = inputs;
  const hasher = new IdentityHasher(env.IDENTITY_HASH_KEYS);
  const encryption = new DataEncryption(env.DATA_ENCRYPTION_KEYS);
  const audit = new AuthAuditRecorder({ db, hasher, logger });
  const sessions = new SessionStore({ redis, encryption });
  const access = new PrismaContentAccessRepository(db);
  const base = env.PUBLIC_BASE_URL;
  const lti = createLtiRoutes({
    db,
    redis,
    logger,
    hasher,
    encryption,
    secrets: env.PSEUDONYM_SECRETS,
    audit,
    access,
    player: inputs.h5p.player,
    canvasOrigins: env.CANVAS_ORIGINS,
    tokenMaxAgeSeconds: env.LTI_TOKEN_MAX_AGE_SECONDS,
    publicBaseUrl: base,
  });
  const feide = new FeideClient({
    issuer: env.FEIDE_ISSUER,
    clientId: env.FEIDE_CLIENT_ID,
    clientSecret: env.FEIDE_CLIENT_SECRET,
    redirectUri: `${base}/auth/feide/callback`,
    postLogoutRedirectUri: `${base}/auth/logged-out`,
  });
  const authenticate = requestPrincipal(lti.resolveLtik);

  const app = express();
  app.disable('x-powered-by');
  // SECURITY: `req.ip` (audit hash, rate limits) trusts only as many proxies as are really in front (TRUST_PROXY).
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(baseSecurityHeaders({ https: base.startsWith('https:') }));
  app.use(healthRoutes({ database: () => db.$queryRaw`SELECT 1`, redis: () => redis.ping() }));
  app.use(portalSessionMiddleware(sessions));
  app.use(lti.router);
  app.use(
    feideLoginRoutes({
      feide,
      transactions: new LoginTransactions(redis),
      sessions,
      audit,
      publicBaseUrl: base,
      logger,
      login: {
        groupsApiUrl: env.FEIDE_GROUPS_API_URL,
        policy: {
          allowedOrgs: env.ALLOWED_FEIDE_ORGS,
          adminFeideIds: env.ADMIN_FEIDE_IDS,
          authorCourseGroups: env.AUTHOR_COURSE_GROUPS,
        },
        accounts: new AccountResolver({ db, hasher }),
        secrets: env.PSEUDONYM_SECRETS,
        audit,
      },
    }),
  );
  app.use(portalHomeRoutes());
  app.use('/api', authenticate, contentSharingRoutes({ db, access }), (_req, _res, next) =>
    next(new HttpError(404, 'error.notFound')),
  );
  app.use('/api', h5pErrorHandler(logger));
  app.use('/h5p', authenticate, createH5pRouter(inputs.h5p, h5pAuthenticate()));
  app.use('/h5p', h5pErrorHandler(logger));
  app.use(portalNotFound());
  app.use(((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    sendPortalError(res, error, logger);
  }) satisfies ErrorRequestHandler);
  return { app, lti };
}
