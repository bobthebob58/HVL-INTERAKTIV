/**
 * collaborationResponses — the answers and path parameters the collaboration routes (./collaborationRoutes.ts) share:
 * who is refused which way, the per-person limits, and the co-author in the path.
 *
 * Why: several collaboration routes refuse the same people the same way (D-090, D-091 as amended); one definition
 *      keeps their OpenAPI texts alike, and keeps the registry under the file-size limit (DOC-007).
 * Spec: DOC-012, PROD-007
 * Invariants:
 *   - Every error answer uses the shared error shape (./routeResponses.ts `failure`).
 * Collaborators: ./collaborationRoutes.ts, ./routeResponses.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, packages/api-contract/test/collaborationSchemas.test.ts
 */
import { z } from 'zod';
import type { ApiResponse } from '../apiRouteTypes.js';
import { contentParams, failure } from './routeResponses.js';

/** 403 of search and the bank list: they are for HVL staff authors only (D-090, D-091 as amended). */
export const staffOnly = failure(
  '`hvl:sharing-not-allowed`: a student author (the page explains it); `error.forbidden`: a learner, or an ' +
    'author who is not HVL staff.',
);

/** 403 of a route that needs Edit on the activity. */
export const editorsOnly = failure(
  '`error.forbidden`: signed in without an author role; `hvl:edit-not-allowed`: may view, not edit.',
);

/** 403 of a route only the owner may use. */
export const ownerOnly = failure(
  '`hvl:owner-only`: only the owner may do this (a co-author may remove only themself); `error.forbidden`: ' +
    'signed in without an author role.',
);

/** 403 of adding a co-author or listing in the bank: also refused to an owner who is not HVL staff. */
export const staffOwnerOnly = failure(
  '`hvl:owner-only`: only the owner may do this; `hvl:sharing-not-allowed`: the owner is a student author ' +
    '(D-059); `error.forbidden`: no author role, or not HVL staff.',
);

/** 400 of people search. */
export const badPeopleQuery = failure(
  '`error.badRequest`: no query, a repeated one, or one shorter than 3 or longer than 100.',
);

/**
 * 429 of a route with a per-person limit: people search (D-090) and duplicating (D-092 as amended). The server
 * sends `Retry-After` with the seconds until the window ends.
 * @param limit - What the person did too often, e.g. "too many searches in a minute".
 * @returns The answer.
 */
export const rateLimited = (limit: string): ApiResponse =>
  failure(`\`hvl:rate-limited\`: ${limit}; \`Retry-After\` says when to try again.`);

/** 403 of duplicating (D-092). */
export const duplicateRefused = failure(
  '`hvl:duplicate-not-allowed`: may view, not copy; `error.forbidden`: no author role; an editor refusal.',
);

/** Path parameters of removing one co-author. */
export const coAuthorParams = contentParams.extend({
  userId: z.uuid().describe('The co-author to remove (a co-author may name only themself).'),
});
