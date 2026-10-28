/**
 * feideLoginWiring — builds the portal's Feide login routes from the configuration: the OpenID Connect client, the
 * login transactions, the account resolver and the role policy (HVL realms, admins, author course groups).
 *
 * Why: the Feide login reads eight configuration variables and four of createApp's shared instances; mapping them
 *      here keeps createApp.ts to the mount order and within the file-size limit (DOC-007) as S5 adds the studio.
 * Spec: AUTH-001, AUTH-002, AUTH-003
 * Invariants:
 *   - The redirect URI is `<PUBLIC_BASE_URL>/auth/feide/callback` and the post-logout URI
 *     `<PUBLIC_BASE_URL>/auth/logged-out`, built on the configured origin, never on request headers.
 *   - The session store, audit recorder and identity hasher are createApp's single instances, shared with the LTI
 *     routes and the request authentication.
 *   - Building contacts nothing: Feide's discovery runs at the first login (../auth/feide/FeideClient.ts).
 * Collaborators: ./createApp.ts (mounts the routes), ../auth/feide/feideLoginRoutes.ts, ../auth/feide/FeideClient.ts,
 *   ../auth/feide/loginTransactions.ts, ../auth/identity/AccountResolver.ts.
 * Tests: apps/server/test/server/createApp.int.test.ts, apps/server/test/http/api/apiDocs.int.test.ts (both sign in
 *   with the mock Feide through the whole app)
 */
import type { Router } from 'express';
import type { Logger } from 'pino';
import type { AuthAuditRecorder } from '../auth/audit/AuthAuditRecorder.js';
import { FeideClient } from '../auth/feide/FeideClient.js';
import { feideLoginRoutes } from '../auth/feide/feideLoginRoutes.js';
import { LoginTransactions } from '../auth/feide/loginTransactions.js';
import { AccountResolver } from '../auth/identity/AccountResolver.js';
import type { SessionStore } from '../auth/session/SessionStore.js';
import type { Env } from '../config/env.js';
import type { Database } from '../infra/prismaClient.js';
import type { Redis } from '../infra/redisClient.js';
import type { IdentityHasher } from '../security/keys/IdentityHasher.js';

/** What the Feide login routes are built from. */
export interface FeideLoginWiringInputs {
  readonly env: Env;
  readonly logger: Logger;
  readonly db: Database;
  readonly redis: Redis;
  /** The portal session store (the one `portalSessionMiddleware` reads). */
  readonly sessions: SessionStore;
  /** Records logins and logouts (D-064). */
  readonly audit: AuthAuditRecorder;
  /** Hashes the Feide identity of each login (D-055). */
  readonly hasher: IdentityHasher;
}

/**
 * Builds `/auth/feide/login`, `/auth/feide/callback`, `/auth/logout` and `/auth/session` from the configuration.
 * @param inputs - Configuration, logger, clients and createApp's shared instances.
 * @returns The router, to mount after the portal session and LTI routes.
 * @spec AUTH-001
 */
export function portalFeideLoginRoutes(inputs: FeideLoginWiringInputs): Router {
  const { env, logger, db, redis, sessions, audit, hasher } = inputs;
  const base = env.PUBLIC_BASE_URL;
  const feide = new FeideClient({
    issuer: env.FEIDE_ISSUER,
    clientId: env.FEIDE_CLIENT_ID,
    clientSecret: env.FEIDE_CLIENT_SECRET,
    redirectUri: `${base}/auth/feide/callback`,
    postLogoutRedirectUri: `${base}/auth/logged-out`,
  });
  return feideLoginRoutes({
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
  });
}
