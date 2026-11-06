/**
 * insightRoutes — `GET /api/content/:contentId/insight` (one view), `…/insight/contexts` (the contexts to choose
 * from), `…/insight/export` (the same view as CSV) and `…/insight/findings` (the validator's findings).
 *
 * Why: the Innsikt tab on the activity page and in the Canvas view `/app/play` (D-101) reads these routes; who may
 *      see which context is INS-007 as D-106 amends it (./insightAccess.ts); every view and download is audited
 *      (DATA-007, ./insightAudit.ts); the CSV carries the same suppression (INS-009, ./insightCsvText.ts); the
 *      findings are INS-010's. The shapes are the contract's (`INSIGHT_ROUTES`). Another site, or an image an author
 *      points here, must not be able to write that audit trail as a signed-in teacher (D-106's amendment of
 *      2026-11-05).
 * Spec: INS-001, INS-006, INS-007, INS-009, INS-010, PROD-010, DATA-007, DOC-012
 * Auth: either — a portal session or an ltik as `Authorization: Bearer` (LTI-003); `requestPrincipal` checks both
 *   before this router. Every route is a GET and takes no CSRF token (D-057); instead, a browser request that is not
 *   a script's fetch from our own origin is refused (`isOwnPageFetch`).
 * Errors: 401 `hvl:unauthenticated`, `hvl:session-expired`, `hvl:ltik-invalid`; 404 `hvl:activity-unavailable`
 *   (unknown or not viewable, D-066); 403 `error.forbidden` (a learner, an admin or colleague who neither owns nor
 *   co-authors the activity, a Canvas author of a course it is not placed in, another context in Canvas, or a
 *   browser request that is not our pages' fetch: a navigation, another origin's request, an image or a frame); 400
 *   `error.badRequest` (the query, a version above the current one, a context the activity lacks); 429
 *   `hvl:rate-limited` with `Retry-After`; 500 (a logged fault) while the app has not wired the insight services.
 * Invariants:
 *   - Who is signed in, then whether it is our pages' fetch, then View and the reader, then the rate limit, then the
 *     query: a refused caller learns nothing from a 400, and only requests the person may make are counted. An app
 *     without the insight services fails (500) only after the sign-in and access checks.
 *   - PRIVACY: no route returns a per-learner row (INS-006): the view and the CSV come from the core's suppressed
 *     report, the contexts carry labels only, the findings no learner at all. Nothing about a learner is logged.
 *   - A view and a download are audited before they are sent; the contexts and findings are not about learners and
 *     are not audited.
 *   - SECURITY: only a request whose `Sec-Fetch-Site` is absent or `same-origin`, `Sec-Fetch-Mode` absent, `cors` or
 *     `same-origin`, and `Sec-Fetch-Dest` absent or `empty` gets past the sign-in check; any other is 403 before
 *     anything is audited or counted. One without fetch metadata is served.
 *   - Every answer is `Cache-Control: no-store` (../../http/api/apiRouter.ts sets it; the CSV sets it again).
 * Collaborators: ./insightAccess.ts, ./insightView.ts, ./insightAudit.ts, ./insightCsvText.ts,
 *   ./insightFindingsAnswer.ts, ./InsightRateLimit.ts, ./insightApi.ts, ../../http/api/apiRouter.ts (mounts it),
 *   ../../http/learningDesignErrors.ts (`hvl:rate-limited`), ../../http/HttpError.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/insight/http/insightRoutes.int.test.ts,
 *   apps/server/test/insight/http/insightPermissions.int.test.ts,
 *   apps/server/test/insight/http/insightFindings.int.test.ts, apps/server/test/insight/http/insightAuditFirst.test.ts,
 *   apps/server/test/insight/http/insightForeignRequest.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import {
  CSV_MEDIA_TYPE,
  type FindingsResponse,
  type InsightContextsResponse,
  type InsightFindingsResponse,
} from '@hvl-interaktiv/api-contract';
import { Router, type Request, type Response } from 'express';
import { requirePrincipal } from '../../auth/principalLocals.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { HttpError } from '../../http/HttpError.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import { pathParam } from '../../http/routeParams.js';
import type { Locale } from '../../i18n/translate.js';
import type { Database } from '../../infra/prismaClient.js';
import type { PersonLimit } from '../../learningDesign/collaboration/PersonRateLimit.js';
import { insightAccess, readerContexts } from './insightAccess.js';
import { auditInsight, INSIGHT_EXPORT_ACTION, INSIGHT_VIEW_ACTION } from './insightAudit.js';
import { insightCsvFilename, insightCsvText } from './insightCsvText.js';
import { insightFindingsAnswer } from './insightFindingsAnswer.js';
import { insightViewOf, type InsightViews } from './insightView.js';

/** The view's path below `/api`. */
export const INSIGHT_PATH = '/content/:contentId/insight';

// SECURITY: the view and the CSV write the audit trail (DATA-007) and every route takes from the limit, while GETs
// take no CSRF token (D-057) and the Lax session cookie goes with another site's navigation and with an image an
// author points at this URL in an activity our player shows. Our pages only `fetch` these routes from their own
// origin, so only that, or a client without fetch metadata, is served (D-106, amended 2026-11-05).
const isOwnPageFetch = (req: Request): boolean => {
  const site = req.get('sec-fetch-site');
  const mode = req.get('sec-fetch-mode');
  const dest = req.get('sec-fetch-dest');
  return (
    (site === undefined || site === 'same-origin') &&
    (mode === undefined || mode === 'cors' || mode === 'same-origin') &&
    (dest === undefined || dest === 'empty')
  );
};

/** The services the insight routes need from the app: the insight core and the per-person limit. */
export interface InsightServices {
  readonly insight: InsightViews;
  /** The per-person request limit (./InsightRateLimit.ts). */
  readonly limit: PersonLimit;
}

/** What the insight routes are built from. */
export interface InsightRouteDeps {
  readonly db: Database;
  /** The activity facts the View check reads. */
  readonly access: ContentAccessRepository;
  /** The stored activity's validator findings (`ContentPublisher.findings`, PROD-003). */
  readonly findings: (contentId: string, locale: Locale) => Promise<FindingsResponse>;
  /** The insight services; undefined until the app wires them, and every route then fails with 500 (fail closed). */
  readonly services: InsightServices | undefined;
}

/**
 * Builds the insight routes.
 * @param deps - The database, the activity facts, the findings and the insight services.
 * @returns A router to mount at `/api`, after the authentication middleware.
 * @spec INS-007
 */
export function insightRoutes(deps: InsightRouteDeps): Router {
  const router = Router();
  const admitted = async (req: Request, res: Response) => {
    const principal = requirePrincipal(res);
    if (!isOwnPageFetch(req)) throw new HttpError(403, 'error.forbidden');
    const access = await insightAccess(deps, principal, pathParam(req, 'contentId'));
    // WHY: without its services the area fails, logged as a fault, rather than answering without the limit or the
    // NRPS base; the sign-in and access checks come first, so their answers stay what the contract says.
    if (!deps.services) throw new Error('insight: the app has not passed the insight services to apiRouter');
    const decision = await deps.services.limit.take(principal.userId);
    if (!decision.allowed) {
      res.set('Retry-After', String(decision.retryAfterSeconds));
      throw learningDesignError('hvl:rate-limited');
    }
    return { principal, access, insight: deps.services.insight };
  };

  router.get(INSIGHT_PATH, async (req, res) => {
    const { principal, access, insight } = await admitted(req, res);
    const report = await insightViewOf(req, access, insight);
    await auditInsight(deps.db, {
      action: INSIGHT_VIEW_ACTION,
      actorUserId: principal.userId,
      scope: report.scope,
    });
    res.json(report);
  });

  router.get(`${INSIGHT_PATH}/contexts`, async (req, res) => {
    const { access, insight } = await admitted(req, res);
    const contexts = readerContexts(access.reader, await insight.contexts(access.contentId));
    res.json({ contexts } satisfies InsightContextsResponse);
  });

  router.get(`${INSIGHT_PATH}/export`, async (req, res) => {
    const { principal, access, insight } = await admitted(req, res);
    const report = await insightViewOf(req, access, insight);
    await auditInsight(deps.db, {
      action: INSIGHT_EXPORT_ACTION,
      actorUserId: principal.userId,
      scope: report.scope,
    });
    res.set({
      'Content-Type': CSV_MEDIA_TYPE,
      'Content-Disposition': `attachment; filename="${insightCsvFilename(report.scope, principal.locale)}"`,
      // PRIVACY: the file is made on demand and kept nowhere, not even in a browser or proxy cache.
      'Cache-Control': 'no-store',
    });
    res.send(insightCsvText(report, principal.locale));
  });

  router.get(`${INSIGHT_PATH}/findings`, async (req, res) => {
    const { principal, access } = await admitted(req, res);
    const findings = await deps.findings(access.contentId, principal.locale);
    res.json(insightFindingsAnswer(findings, access.mayEdit) satisfies InsightFindingsResponse);
  });
  return router;
}
