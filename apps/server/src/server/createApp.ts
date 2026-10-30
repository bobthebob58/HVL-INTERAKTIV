/**
 * createApp — builds the Express app: health check, portal session, LTI, Feide login, the `/api` routes (me,
 * content, publishing, sharing, the studio, docs), the H5P routes and the fallback pages, in the order the security
 * rules need.
 *
 * Why: spec 02 joins two entry points (Canvas via LTI, the portal via Feide) into one principal; the mount order
 *      decides which checks a request meets. The app is built from connected clients so tests and `main.ts` run the
 *      same code. The studio's services are built in ./studioServices.ts.
 * Spec: AUTH-001, AUTH-003, LTI-001, LTI-003, H5P-007, PROD-006, PROD-003, DOC-012, NFR-002, PED-001
 * Invariants:
 *   - Order: trust proxy → base headers → `/healthz` → page assets → the Hjelp marker and the chrome redirect (with
 *     the web app) → portal session → LTI (ltijs first) → Feide routes → start page (only without the web app) →
 *     `/api` → `/h5p` → the web app (GET and HEAD, when loaded) → HTML 404 → last-resort error page. With the web app,
 *     launches land on `/app/play` and H5P pages opened on their own go to their chrome page (D-067).
 *   - `/api` and `/h5p` authenticate with `requestPrincipal` (ltik as Bearer or an allowed query, else the portal
 *     session with CSRF); signed file URLs are checked before it, inside the H5P router (D-058).
 *   - `X-Powered-By` is off; every response gets `nosniff` and `no-referrer`, and HSTS when the base URL is https.
 *   - The findings API, the publish API and the save gate of `/h5p` share one validator and one Redis write lock
 *     (D-074); the gate reads what the editor will store; `/api/docs` is mounted only when NODE_ENV is not
 *     production (D-077).
 *   - The studio's services are built once, from the same activity facts, identity hasher and publish flow as the
 *     S4 routes, and are returned so main.ts can close them at shutdown.
 * Collaborators: ../lti/ltiRoutes.ts, ./feideLoginWiring.ts, ../auth/requestPrincipal.ts,
 *   ../http/createH5pRouter.ts, ../http/h5pAuthenticate.ts, ../http/api/apiRouter.ts,
 *   ../content/PublishedSaveGate.ts, ../content/ContentWriteLock.ts, ../content/savedForm.ts, ../web/webRoutes.ts,
 *   ../web/chromeRedirect.ts, ../http/pages/helpLink.ts, ./healthRoutes.ts, ./studioServices.ts, ./main.ts.
 * Tests: apps/server/test/server/createApp.int.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import express, { type ErrorRequestHandler, type Express } from 'express';
import type { Logger } from 'pino';
import { AuthAuditRecorder } from '../auth/audit/AuthAuditRecorder.js';
import { requestPrincipal } from '../auth/requestPrincipal.js';
import { portalSessionMiddleware } from '../auth/session/portalSessionMiddleware.js';
import { SessionStore } from '../auth/session/SessionStore.js';
import type { Env } from '../config/env.js';
import { RedisContentWriteLock } from '../content/ContentWriteLock.js';
import { PublishedSaveGate } from '../content/PublishedSaveGate.js';
import type { PublishingDeps } from '../content/publishingDeps.js';
import { editorSavedForm } from '../content/savedForm.js';
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
import type { StudioContent } from '../learningDesign/content/loadStudioContent.js';
import type { Redis } from '../infra/redisClient.js';
import { createLtiRoutes, type LtiRoutes } from '../lti/ltiRoutes.js';
import { DataEncryption } from '../security/keys/DataEncryption.js';
import { IdentityHasher } from '../security/keys/IdentityHasher.js';
import type { ContentValidator } from '../validation/types.js';
import type { WebApp } from '../web/nextWebApp.js';
import { chromeRedirect } from '../web/chromeRedirect.js';
import { offerHelpLink } from '../http/pages/helpLink.js';
import { webRoutes } from '../web/webRoutes.js';
import { portalFeideLoginRoutes } from './feideLoginWiring.js';
import { healthRoutes } from './healthRoutes.js';
import { createStudioServices, type StudioServices } from './studioServices.js';

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
  /** The studio content, loaded and checked once at start-up (D-082, ../learningDesign/content/). */
  readonly studioContent: StudioContent;
}

/** The app and the parts `main.ts` needs at start-up. */
export interface App {
  readonly app: Express;
  readonly lti: LtiRoutes;
  /** The studio's services: main.ts closes them at shutdown, and tests reach them here. */
  readonly studio: StudioServices;
}

/**
 * Builds the app.
 * @param inputs - Configuration, logger, connected clients, the H5P engine and the studio content.
 * @returns The Express app, the LTI parts and the studio's services.
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
  const authenticate = requestPrincipal(lti.resolveLtik);
  // WHY: the validator is built from configuration loaded at start-up (D-073) and passed in by main.ts; without one,
  // the publish flow runs with a validator that finds nothing, so publishing works and never blocks.
  const publishing: PublishingDeps = {
    db,
    validator: inputs.validator ?? (() => []),
    clock: () => new Date(),
    writeLock: new RedisContentWriteLock(redis),
  };
  const studio = createStudioServices({ ...inputs, access, hasher, publishing });
  // WHY: the content routes inside the H5P router run the same publish gate on saves of published activities.
  const saveGate = new PublishedSaveGate(publishing, editorSavedForm(inputs.h5p.editor.libraryManager));
  const h5pRoutes: ContentRouteDeps = { ...inputs.h5p, saveGate, duplicator: studio.duplicator };

  const app = express();
  app.disable('x-powered-by');
  // SECURITY: `req.ip` (audit hash, rate limits) trusts only as many proxies as are really in front (TRUST_PROXY).
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(baseSecurityHeaders({ https: base.startsWith('https:') }));
  app.use(healthRoutes({ database: () => db.$queryRaw`SELECT 1`, redis: () => redis.ping() }));
  app.use(pageAssetRoutes());
  // WHY: with the web app, an H5P page opened on its own goes to the chrome page that frames it (D-067), and /hjelp
  // exists, so the server's own pages show the Hjelp header unless our chrome frames them (UD-013, D-067).
  if (inputs.web) app.use(offerHelpLink(), chromeRedirect());
  app.use(portalSessionMiddleware(sessions));
  app.use(lti.router);
  app.use(portalFeideLoginRoutes({ ...inputs, sessions, audit, hasher }));
  // WHY: with the web app, `/` is its start page (D-067); the server-rendered one serves WEB_APP=off.
  if (!inputs.web) app.use(portalHomeRoutes());
  app.use(
    '/api',
    authenticate,
    apiRouter({ publishing, access, studio, serveDocs: env.NODE_ENV !== 'production' }),
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
  return { app, lti, studio };
}
