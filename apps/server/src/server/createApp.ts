/**
 * createApp — builds the Express app: health check, portal session, LTI, Feide login, the `/api` routes (me,
 * content, publishing, sharing, docs), the H5P routes and the fallback pages, in the order the security rules need.
 *
 * Why: spec 02 joins two entry points (Canvas via LTI, the portal via Feide) into one principal; the mount order
 *      decides which checks a request meets. The app is built from connected clients so tests and `main.ts` run the
 *      same code.
 * Spec: AUTH-001, AUTH-003, LTI-001, LTI-003, H5P-007, PROD-006, PROD-003, DOC-012, NFR-002
 * Invariants:
 *   - Order: trust proxy → base headers → `/healthz` → page assets → the chrome redirect (with the web app) →
 *     portal session → LTI (ltijs first) → Feide routes → start page (only without the web app) → `/api` → `/h5p` →
 *     the web app (GET and HEAD, when loaded) → HTML 404 → last-resort error page. With the web app, launches land
 *     on `/app/play` and H5P pages opened on their own go to their chrome page (D-067).
 *   - `/api` and `/h5p` authenticate with `requestPrincipal` (ltik as Bearer or an allowed query, else the portal
 *     session with CSRF); signed file URLs are checked before it, inside the H5P router (D-058).
 *   - `X-Powered-By` is off; every response gets `nosniff` and `no-referrer`, and HSTS when the base URL is https.
 *   - The findings API, the publish API and the save gate of `/h5p` share one validator; `/api/docs` is mounted
 *     only when NODE_ENV is not production (D-077).
 * Collaborators: ../lti/ltiRoutes.ts, ../auth/feide/feideLoginRoutes.ts, ../auth/requestPrincipal.ts,
 *   ../http/createH5pRouter.ts, ../http/h5pAuthenticate.ts, ../http/api/apiRouter.ts,
 *   ../content/PublishedSaveGate.ts, ../web/webRoutes.ts, ../web/chromeRedirect.ts, ./healthRoutes.ts, ./main.ts.
 * Tests: apps/server/test/server/createApp.int.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
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
import { PublishedSaveGate } from '../content/PublishedSaveGate.js';
import type { PublishingDeps } from '../content/publishingDeps.js';
import type { H5pRouteDeps } from '../http/h5pRouteDeps.js';
import { PrismaContentAccessRepository } from '../h5p/permissions/ContentAccessRepository.js';
import { apiRouter } from '../http/api/apiRouter.js';
import { createH5pRouter } from '../http/createH5pRouter.js';
import { h5pAuthenticate } from '../http/h5pAuthenticate.js';
import { h5pErrorHandler } from '../http/h5pErrorHandler.js';
import { HttpError } from '../http/HttpError.js';
import { pageAssetRoutes } from '../http/pages/pageAssetRoutes.js';
import { portalHomeRoutes, portalNotFound } from '../http/pages/portalHomeRoutes.js';
import { sendPortalError } from '../http/pages/portalPages.js';
import type { ContentRouteDeps } from '../http/routes/contentRoutes.js';
import { baseSecurityHeaders } from '../http/securityHeaders.js';
import type { Database } from '../infra/prismaClient.js';
import type { Redis } from '../infra/redisClient.js';
import { createLtiRoutes, type LtiRoutes } from '../lti/ltiRoutes.js';
import { DataEncryption } from '../security/keys/DataEncryption.js';
import { IdentityHasher } from '../security/keys/IdentityHasher.js';
import type { ContentValidator } from '../validation/types.js';
import type { WebApp } from '../web/nextWebApp.js';
import { chromeRedirect } from '../web/chromeRedirect.js';
import { webRoutes } from '../web/webRoutes.js';
import { healthRoutes } from './healthRoutes.js';

/** What the app is built from. */
export interface AppInputs {
  readonly env: Env;
  readonly logger: Logger;
  readonly db: Database;
  readonly redis: Redis;
  /** The H5P engine (../h5p/createH5pRuntime.ts). */
  readonly h5p: H5pRouteDeps;
  /** The web app, unless `WEB_APP` is `off` (../web/nextWebApp.ts). */
  readonly web?: Pick<WebApp, 'dev' | 'handle'>;
  /** The pre-publish validator (UD-020) with its configuration bound; see `createApp` for the default. */
  readonly validator?: ContentValidator;
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
    pageCsp: inputs.h5p.pageCsp,
    editorView: inputs.h5p,
    chromePages: Boolean(inputs.web),
    canvasOrigins: env.CANVAS_ORIGINS,
    tokenMaxAgeSeconds: env.LTI_TOKEN_MAX_AGE_SECONDS,
    publicBaseUrl: base,
    platforms: env.LTI_PLATFORMS,
    allowedFeideOrgs: env.ALLOWED_FEIDE_ORGS,
  });
  const feide = new FeideClient({
    issuer: env.FEIDE_ISSUER,
    clientId: env.FEIDE_CLIENT_ID,
    clientSecret: env.FEIDE_CLIENT_SECRET,
    redirectUri: `${base}/auth/feide/callback`,
    postLogoutRedirectUri: `${base}/auth/logged-out`,
  });
  const authenticate = requestPrincipal(lti.resolveLtik);
  // WHY: the validator is built from configuration loaded at start-up (D-073) and passed in by main.ts; without one,
  // the publish flow runs with a validator that finds nothing, so publishing works and never blocks.
  const publishing: PublishingDeps = {
    db,
    validator: inputs.validator ?? (() => []),
    clock: () => new Date(),
  };
  // WHY: the content routes inside the H5P router run the same publish gate on saves of published activities.
  const h5pRoutes: ContentRouteDeps = { ...inputs.h5p, saveGate: new PublishedSaveGate(publishing) };

  const app = express();
  app.disable('x-powered-by');
  // SECURITY: `req.ip` (audit hash, rate limits) trusts only as many proxies as are really in front (TRUST_PROXY).
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(baseSecurityHeaders({ https: base.startsWith('https:') }));
  app.use(healthRoutes({ database: () => db.$queryRaw`SELECT 1`, redis: () => redis.ping() }));
  app.use(pageAssetRoutes());
  // WHY: with the web app, an H5P page opened on its own goes to the chrome page that frames it (D-067).
  if (inputs.web) app.use(chromeRedirect());
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
  // WHY: with the web app, `/` is its start page (D-067); the server-rendered one serves WEB_APP=off.
  if (!inputs.web) app.use(portalHomeRoutes());
  app.use(
    '/api',
    authenticate,
    apiRouter({ publishing, access, serveDocs: env.NODE_ENV !== 'production' }),
    (_req, _res, next) => next(new HttpError(404, 'error.notFound')),
  );
  app.use('/api', h5pErrorHandler(logger));
  app.use('/h5p', authenticate, createH5pRouter(h5pRoutes, h5pAuthenticate()));
  app.use('/h5p', h5pErrorHandler(logger));
  if (inputs.web) {
    const formActionOrigins = [new URL(env.FEIDE_ISSUER).origin];
    app.use(webRoutes(inputs.web, { canvasOrigins: env.CANVAS_ORIGINS, formActionOrigins }));
  }
  app.use(portalNotFound());
  app.use(((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    sendPortalError(res, error, logger);
  }) satisfies ErrorRequestHandler);
  return { app, lti };
}
