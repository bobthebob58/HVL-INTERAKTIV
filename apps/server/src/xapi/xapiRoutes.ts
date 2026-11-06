/**
 * xapiRoutes — `POST /api/h5p/xapi`: the player bridge's batch of xAPI statements about one activity.
 *
 * Why: LTI-011's endpoint. The contract (`GRADE_BRIDGE_ROUTES`, D-115) answers 202 with an empty body and no detail
 *      per item; 400, 403 and 413 refuse the whole batch, which the bridge then drops; 429 asks it to retry later.
 * Spec: LTI-011, DATA-012, DOC-012
 * Auth: either — the portal session with `X-CSRF-Token` (D-057) or the ltik as `Authorization: Bearer` (LTI-003);
 *   `requestPrincipal` checks both before this router, and an ltik in the query is refused there (D-058, D-069).
 * Errors: 401 `hvl:unauthenticated`, `hvl:csrf-invalid`, `hvl:session-expired`, `hvl:ltik-invalid`; 413 `too-large`
 *   (`error.tooLarge`, a body over 64 KiB); 400 `error.badRequest` (not an envelope, no items or over 50, or a version
 *   above the current one); 403 `error.forbidden`; 429 `hvl:rate-limited` with `Retry-After`.
 * Invariants:
 *   - Who is signed in is checked before the body is read, so a stranger learns nothing from a 413 or a 400.
 *   - The envelope is checked with the contract's schema; each item is checked on its own later (D-115).
 *   - PRIVACY: the answer carries nothing about which items were stored, nor whether the sender is a learner (D-102).
 * Collaborators: ./XapiIngest.ts, ../http/api/apiBodies.ts, ../http/api/apiRouter.ts (mounts it),
 *   ../http/learningDesignErrors.ts (`hvl:rate-limited`), @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/xapi/xapiRouteAuth.int.test.ts, apps/server/test/xapi/xapiLimits.int.test.ts
 */
import { XAPI_BATCH_MAX_BYTES, xapiBatchEnvelopeSchema } from '@hvl-interaktiv/api-contract';
import { Router, type RequestHandler } from 'express';
import { ltiSubjectOf, requirePrincipal } from '../auth/principalLocals.js';
import { apiJson, parseBody } from '../http/api/apiBodies.js';
import { learningDesignError } from '../http/learningDesignErrors.js';
import type { XapiIngest } from './XapiIngest.js';

/** The path of the batch route below `/api`. */
export const XAPI_PATH = '/h5p/xapi';

/** Refuses a request from nobody before its body is read. */
const signedIn: RequestHandler = (_req, res, next) => {
  requirePrincipal(res);
  next();
};

/**
 * Builds the xAPI batch route.
 * @param deps - The ingestion.
 * @returns A router to mount at `/api`, after the authentication middleware.
 */
export function xapiRoutes(deps: { ingest: Pick<XapiIngest, 'ingest'> }): Router {
  const router = Router();
  // WHY: D-115's limit is 64 KiB; the bridge keeps a batch under 60 000 bytes so a `keepalive` flush fits too.
  router.post(XAPI_PATH, signedIn, apiJson(`${XAPI_BATCH_MAX_BYTES}b`), async (req, res) => {
    const principal = requirePrincipal(res);
    const batch = parseBody(xapiBatchEnvelopeSchema, req.body);
    const outcome = await deps.ingest.ingest(principal, batch, { ltiSubject: ltiSubjectOf(res) });
    if (outcome.kind === 'limited') {
      res.set('Retry-After', String(outcome.retryAfterSeconds));
      throw learningDesignError('hvl:rate-limited');
    }
    res.status(202).end();
  });
  return router;
}
