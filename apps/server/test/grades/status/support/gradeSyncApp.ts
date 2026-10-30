/**
 * gradeSyncApp — the grade-sync routes on the test database with an injected principal, for the status and retry
 * tests.
 *
 * Why: the routes' rules (View first, then D-106's scope) are tested with every kind of person: owner, co-author,
 *      colleague, admin, learner, and Canvas authors of courses the activity is or is not placed in. Only the
 *      authentication is replaced; the routes, the permission rules, the schemas and the error handler are the
 *      server's own.
 * Spec: LTI-012
 * Collaborators: ../../../../src/grades/status/gradeSyncRoutes.ts, ../../../../src/http/h5pErrorHandler.ts,
 *   ./gradeSyncFixture.ts.
 * Tests: used by ../gradeSyncRoutes.int.test.ts and ../gradeSyncRetry.int.test.ts.
 */
import express, { type Express } from 'express';
import type { LtiLaunchFacts, Principal, Role } from '../../../../src/auth/Principal.js';
import { setPrincipal } from '../../../../src/auth/principalLocals.js';
import { gradeSyncRoutes } from '../../../../src/grades/status/gradeSyncRoutes.js';
import { PrismaContentAccessRepository } from '../../../../src/h5p/permissions/ContentAccessRepository.js';
import { h5pErrorHandler } from '../../../../src/http/h5pErrorHandler.js';
import type { Database } from '../../../../src/infra/prismaClient.js';
import type { PersonLimit } from '../../../../src/learningDesign/collaboration/PersonRateLimit.js';
import { createLogger } from '../../../../src/logging/logger.js';

/** A limit that always allows, for the tests that are not about it. */
export const NO_LIMIT: PersonLimit = { take: async () => ({ allowed: true }) };

/**
 * A portal principal.
 * @param userId - The account.
 * @param roles - Its roles; an author by default.
 * @returns The principal.
 */
export const portalPrincipal = (userId: string, roles: Role[] = ['author']): Principal => ({
  userId,
  learnerKey: 'lk',
  roles,
  mode: 'portal',
  locale: 'nn',
  hvlMember: true,
  feideAuthenticated: true,
  studentAuthor: false,
});

/**
 * A Canvas principal launched from one course.
 * @param userId - The account.
 * @param launch - The launch's platform and course (and activity, when it opened one).
 * @param roles - Its roles; an author by default.
 * @returns The principal.
 */
export const canvasPrincipal = (
  userId: string,
  launch: Pick<LtiLaunchFacts, 'platformId' | 'contextId'> & { contentId?: string },
  roles: Role[] = ['author'],
): Principal => ({
  userId,
  learnerKey: 'lk',
  roles,
  mode: 'lti',
  locale: 'nn',
  hvlMember: false,
  feideAuthenticated: false,
  studentAuthor: false,
  lti: { deploymentId: 'd', messageType: 'LtiResourceLinkRequest', ...launch },
});

/**
 * The routes as one principal sees them.
 * @param db - The database.
 * @param principal - Who makes the requests; nobody when undefined.
 * @param options - The retry limit and the clock.
 * @returns The app.
 */
export function gradeSyncAppAs(
  db: Database,
  principal: Principal | undefined,
  options: { retryLimit?: PersonLimit; clock?: () => Date } = {},
): Express {
  return express()
    .use((_req, res, next) => {
      if (principal) setPrincipal(res, principal);
      next();
    })
    .use(
      '/api',
      gradeSyncRoutes({
        db,
        access: new PrismaContentAccessRepository(db),
        retryLimit: options.retryLimit ?? NO_LIMIT,
        ...(options.clock ? { clock: options.clock } : {}),
      }),
    )
    .use(h5pErrorHandler(createLogger({ level: 'silent' })));
}
