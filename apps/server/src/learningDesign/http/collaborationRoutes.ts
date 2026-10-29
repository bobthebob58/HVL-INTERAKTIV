/**
 * collaborationRoutes — the collaboration routes under `/api`: finding HVL staff, co-authors, the content bank and
 * duplicating an activity.
 *
 * Why: `PROD-007` lets HVL authors work on an activity together, share it through the content bank and copy it with
 *      its source kept (D-090, D-091, D-092, each as amended). This is the area's one router, mounted by the studio
 *      router (../../http/api/studioRouter.ts).
 * Spec: PROD-007
 * Auth: portal — a signed-in author (Feide session), with the CSRF token on writes (checked by the authentication
 *   middleware). Every route starts with `requirePortalAuthor` (./studioPrincipal.ts): an ltik is 401, a portal
 *   learner 403. Search and the bank are for HVL staff authors only (../collaboration/staffEligibility.ts).
 * Errors: 401 `hvl:unauthenticated` (signed out, or a Canvas ltik), `hvl:session-expired`, `hvl:ltik-invalid`,
 *   `hvl:csrf-invalid`; 403 `error.forbidden` (a learner, or an author who is not HVL staff), `hvl:sharing-not-allowed`
 *   (a student author: search, adding, listing, the bank), `hvl:edit-not-allowed`, `hvl:owner-only` and
 *   `hvl:duplicate-not-allowed`; 404 `hvl:activity-unavailable` (D-066); 400 `error.badRequest` and
 *   `hvl:coauthor-not-eligible`; 409 `hvl:coauthor-limit` and `hvl:bank-not-eligible`; 429 `hvl:rate-limited` with
 *   `Retry-After`; 500 `hvl:duplicate-failed` (nothing was saved); an editor refusal (4xx) passes through.
 * Invariants:
 *   - Who asks is checked first, then the decision about the activity, and only then the body or the query, so a
 *     refused caller learns nothing from a 400.
 *   - PRIVACY: the people search answers `{ userId, displayName }` only, and its query is never logged, audited or
 *     echoed: it reaches only the directory, whose errors name no value (D-090, DATA-009).
 *   - Copies go through `studio.duplicator`, which decides `duplicateRules` first and then counts the person's copy
 *     limit (D-092 as amended; a 429 carries `Retry-After`); the route allows a copy as long as Lumi takes to stream
 *     a large video's files (`DUPLICATE_TIME_LIMIT_MS`).
 *   - Registered with full paths below `/api` and the body parser on each route that has a body (no path-less
 *     `use`); every route here is listed in packages/api-contract/src/routes/collaborationRoutes.ts (DOC-012).
 * Collaborators: ../../http/api/studioRouter.ts (mounts it), ./studioRouteDeps.ts, ./studioPrincipal.ts,
 *   ../collaboration/PeopleDirectory.ts, ../collaboration/coAuthorRequests.ts, ../collaboration/contentBank.ts,
 *   ../collaboration/bankEntries.ts, ../collaboration/ContentDuplicator.ts, ../../auth/principalToH5pActor.ts,
 *   ../../http/api/apiBodies.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/collaboration/peopleSearch.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/peopleSearchPrivacy.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/coAuthorRoutes.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/coAuthorAccess.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/contentBank.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/bankList.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/duplicateRoute.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/copyRateLimit.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/collaborationSession.int.test.ts (CSRF and a real ltik),
 *   apps/server/test/http/api/studioRouter.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import {
  peopleQuerySchema,
  type DuplicateResponse,
  type PeopleSearchResponse,
} from '@hvl-interaktiv/api-contract';
import { Router, type Request } from 'express';
import type { Principal } from '../../auth/Principal.js';
import { principalToH5pActor } from '../../auth/principalToH5pActor.js';
import { apiJson, parseBody } from '../../http/api/apiBodies.js';
import { authError } from '../../http/authErrors.js';
import { HttpError } from '../../http/HttpError.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import { pathParam } from '../../http/routeParams.js';
import { readBank } from '../collaboration/bankEntries.js';
import {
  addCoAuthorRequest,
  listCoAuthors,
  removeCoAuthorRequest,
} from '../collaboration/coAuthorRequests.js';
import { listInBankRequest, readBankListing, unlistFromBankRequest } from '../collaboration/contentBank.js';
import { retryAfterOf } from '../collaboration/CopyRateLimit.js';
import { isBankReader } from '../collaboration/staffEligibility.js';
import { requirePortalAuthor } from './studioPrincipal.js';
import type { StudioRouteDeps } from './studioRouteDeps.js';

const COAUTHORS_PATH = '/content/:contentId/coauthors';
const BANK_LISTING_PATH = '/content/:contentId/bank';

/** How long a duplicate may take: Lumi streams every file of the source through the server (D-092 probe P2). */
export const DUPLICATE_TIME_LIMIT_MS = 15 * 60_000;

/**
 * The checks of search and the bank: an HVL staff author signed in on the portal (D-090, D-091 as amended).
 * @param principal - A portal author.
 * @throws HttpError 403 `hvl:sharing-not-allowed` for a student author, which the page explains; 403
 *   `error.forbidden` for an author who is not HVL staff (an admin-only member).
 */
function requireStaffAuthor(principal: Principal): void {
  // PRIVACY: colleagues' names are shown to HVL staff only, and /personvern tells only them (D-090, D-091).
  if (principal.studentAuthor) throw authError('hvl:sharing-not-allowed');
  if (!isBankReader(principal)) throw new HttpError(403, 'error.forbidden');
}

/** The people search's query (`?q=`), trimmed; 400 when missing, repeated, too short or too long. */
const peopleQueryOf = (req: Request): string => parseBody(peopleQuerySchema, { ...req.query }).q;

/**
 * Builds the collaboration routes.
 * @param deps - The studio's route inputs; this area uses `studio.peopleDirectory`, `studio.duplicator`, `db`,
 *   `access` and `clock`.
 * @returns A router to mount at the root of the studio router.
 * @spec PROD-007
 */
export function collaborationRoutes(deps: StudioRouteDeps): Router {
  const router = Router();
  const requests = () => ({ ...deps, people: deps.studio.peopleDirectory });

  router.get('/people', async (req, res) => {
    const principal = requirePortalAuthor(res);
    requireStaffAuthor(principal);
    const outcome = await deps.studio.peopleDirectory.search(
      principal.userId,
      peopleQueryOf(req),
      deps.clock(),
    );
    if (outcome.kind === 'limited') {
      res.set('Retry-After', String(outcome.retryAfterSeconds));
      throw learningDesignError('hvl:rate-limited');
    }
    res.json({ people: [...outcome.people] } satisfies PeopleSearchResponse);
  });

  router.get(COAUTHORS_PATH, async (req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(await listCoAuthors(requests(), principal, pathParam(req, 'contentId')));
  });

  // WHY: the body is one user ID.
  router.post(COAUTHORS_PATH, apiJson('1kb'), async (req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(await addCoAuthorRequest(requests(), principal, pathParam(req, 'contentId'), req.body));
  });

  router.delete(`${COAUTHORS_PATH}/:userId`, async (req, res) => {
    const principal = requirePortalAuthor(res);
    const [contentId, userId] = [pathParam(req, 'contentId'), pathParam(req, 'userId')];
    res.json(await removeCoAuthorRequest(requests(), principal, contentId, userId));
  });

  router.get(BANK_LISTING_PATH, async (req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(await readBankListing(deps, principal, pathParam(req, 'contentId')));
  });

  // WHY: the body is one consent version.
  router.put(BANK_LISTING_PATH, apiJson('1kb'), async (req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(await listInBankRequest(deps, principal, pathParam(req, 'contentId'), req.body));
  });

  router.delete(BANK_LISTING_PATH, async (req, res) => {
    const principal = requirePortalAuthor(res);
    res.json(await unlistFromBankRequest(deps, principal, pathParam(req, 'contentId')));
  });

  router.get('/bank', async (_req, res) => {
    const principal = requirePortalAuthor(res);
    requireStaffAuthor(principal);
    res.json(await readBank(deps.db, principal));
  });

  router.post('/content/:contentId/duplicate', async (req, res) => {
    const principal = requirePortalAuthor(res);
    // WHY: copying a large video's files takes minutes while the socket stays silent. Node's server sets no idle
    // limit of its own (`server.timeout` is 0), so this is an explicit bound that leaves such a copy room to finish.
    req.setTimeout(DUPLICATE_TIME_LIMIT_MS);
    const actor = principalToH5pActor(principal);
    const copying = deps.studio.duplicator.duplicate(pathParam(req, 'contentId'), actor);
    const { contentId } = await copying.catch((error: unknown) => {
      const retryAfter = retryAfterOf(error);
      if (retryAfter !== undefined) res.set('Retry-After', String(retryAfter));
      throw error;
    });
    res.status(201).json({ contentId } satisfies DuplicateResponse);
  });
  return router;
}
