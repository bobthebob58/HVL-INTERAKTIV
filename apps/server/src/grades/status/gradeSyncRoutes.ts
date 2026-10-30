/**
 * gradeSyncRoutes — `GET /api/content/:contentId/grade-sync` (each visible placement's jobs sent, pending, failed and
 * orphaned) and `POST /api/content/:contentId/grade-sync/retry` (send a placement's failed jobs again).
 *
 * Why: LTI-012's acceptance: authors see a per-activity sync status and can retry failed jobs, on the activity page
 *      and in `/app/play` (D-104); who may see which placement follows D-106 (./gradeSyncScope.ts). The shapes are
 *      the contract's (`GRADE_BRIDGE_ROUTES`, packages/api-contract/src/gradeSync.ts).
 * Spec: LTI-012, LTI-006, LTI-007, DATA-007, DOC-012
 * Auth: either — a portal session (the CSRF token on POST) or an ltik as `Authorization: Bearer` (LTI-003);
 *   `requestPrincipal` checks both before this router.
 * Errors: 401 `hvl:unauthenticated`, `hvl:session-expired`, `hvl:ltik-invalid`, `hvl:csrf-invalid`; 400
 *   `error.badRequest` (the retry's body); 404 `hvl:activity-unavailable` (unknown or not viewable, D-066, or a
 *   placement the person may not see); 403 `error.forbidden` (a learner, an admin who does not author the activity, a
 *   colleague who may only view it, or a Canvas author of a course it is not placed in); 429 `hvl:rate-limited` with
 *   `Retry-After` (more than ten retries in ten minutes).
 * Invariants:
 *   - Who is signed in is checked before the body is read; View before the scope; the scope before the rate limit, so
 *     only a retry the person may make is counted.
 *   - PRIVACY: answers carry counts only, never a learner key, Canvas user ID or score; the counts are not
 *     k-suppressed (spec 05 §3, D-106).
 *   - Orphaned jobs are never retried (D-104); a retry is audited (./gradeSyncRetry.ts).
 * Collaborators: ./gradeSyncAccess.ts, ./gradeSyncStatus.ts, ./gradeSyncRetry.ts, ./GradeSyncRetryRateLimit.ts,
 *   ../../http/api/apiRouter.ts (mounts it), ../../http/api/apiBodies.ts, ../../http/learningDesignErrors.ts
 *   (`hvl:rate-limited`), @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/grades/status/gradeSyncRoutes.int.test.ts,
 *   apps/server/test/grades/status/gradeSyncRetry.int.test.ts
 */
import {
  gradeSyncRetryRequestSchema,
  type GradeSyncRetryResponse,
  type GradeSyncStatusResponse,
} from '@hvl-interaktiv/api-contract';
import { Router, type RequestHandler } from 'express';
import { requirePrincipal } from '../../auth/principalLocals.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { apiJson, parseBody } from '../../http/api/apiBodies.js';
import { authError } from '../../http/authErrors.js';
import { HttpError } from '../../http/HttpError.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import { pathParam } from '../../http/routeParams.js';
import type { Database } from '../../infra/prismaClient.js';
import { systemClock, type JobClock } from '../../jobs/jobClock.js';
import type { PersonLimit } from '../../learningDesign/collaboration/PersonRateLimit.js';
import { gradeSyncAccess } from './gradeSyncAccess.js';
import { placementWhere } from './gradeSyncScope.js';
import { retryFailedJobs } from './gradeSyncRetry.js';
import { readGradeSyncPlacements } from './gradeSyncStatus.js';

/** The status route's path below `/api`. */
export const GRADE_SYNC_PATH = '/content/:contentId/grade-sync';

/** What the grade-sync routes are built from. */
export interface GradeSyncRouteDeps {
  readonly db: Database;
  /** The activity facts the View check and the scope read. */
  readonly access: ContentAccessRepository;
  /** The per-person retry limit (./GradeSyncRetryRateLimit.ts). */
  readonly retryLimit: PersonLimit;
  /** When a retry happens; the system clock unless a test passes its own. */
  readonly clock?: JobClock;
}

/** Refuses a request from nobody before its body is read. */
const signedIn: RequestHandler = (_req, res, next) => {
  requirePrincipal(res);
  next();
};

/**
 * Builds the grade-sync status and retry routes.
 * @param deps - The database, the activity facts, the retry limit and the clock.
 * @returns A router to mount at `/api`, after the authentication middleware.
 */
export function gradeSyncRoutes(deps: GradeSyncRouteDeps): Router {
  const router = Router();
  const clock = deps.clock ?? systemClock;

  router.get(GRADE_SYNC_PATH, async (req, res) => {
    const principal = requirePrincipal(res);
    const { contentId, scope } = await gradeSyncAccess(deps.access, principal, pathParam(req, 'contentId'));
    const placements = await readGradeSyncPlacements(deps.db, contentId, scope);
    // WHY: a Canvas author sees the activity's grade sync only through a course it is placed in (D-106).
    if (scope.kind === 'course' && placements.length === 0) throw new HttpError(403, 'error.forbidden');
    res.json({ contentId, placements } satisfies GradeSyncStatusResponse);
  });

  router.post(`${GRADE_SYNC_PATH}/retry`, signedIn, apiJson('1kb'), async (req, res) => {
    const principal = requirePrincipal(res);
    const { placementId } = parseBody(gradeSyncRetryRequestSchema, req.body);
    const { contentId, scope } = await gradeSyncAccess(deps.access, principal, pathParam(req, 'contentId'));
    // SECURITY: the placement must be this activity's and in the person's scope; any other is "not available".
    const placement = await deps.db.ltiPlacement.findFirst({
      where: { id: placementId.toLowerCase(), ...placementWhere(contentId, scope) },
      select: { id: true },
    });
    if (!placement) throw authError('hvl:activity-unavailable');
    const decision = await deps.retryLimit.take(principal.userId);
    if (!decision.allowed) {
      res.set('Retry-After', String(decision.retryAfterSeconds));
      throw learningDesignError('hvl:rate-limited');
    }
    const outcome = await retryFailedJobs(deps.db, {
      placementId: placement.id,
      actorUserId: principal.userId,
      mode: principal.mode,
      now: clock(),
    });
    res.json(outcome satisfies GradeSyncRetryResponse);
  });
  return router;
}
