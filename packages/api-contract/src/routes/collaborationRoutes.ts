/**
 * collaborationRoutes — the registry of the collaboration routes under `/api`: people search, co-authors, the
 * content bank and duplicating.
 *
 * Why: D-099 splits the `/api` registry by area, so each area's routes are in its own table and a change to one area
 *      never edits another's; ../apiRoutes.ts concatenates the areas in document order.
 * Spec: DOC-012, PROD-007
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./collaborationSchemaNames.ts.
 *   - Every signed-in route documents 401 (./routeResponses.ts has the shared answers).
 *   - Removing a co-author or a bank listing is a `DELETE` (D-099); people search never logs its query (D-090).
 *   - Every route is portal-only (`auth: 'portal'`, D-090 as amended, D-098): an ltik answers 401, a learner 403.
 * Collaborators: ./routeResponses.ts, ./collaborationResponses.ts, ./collaborationSchemaNames.ts, ../collaboration.ts,
 *   ../apiRoutes.ts, apps/server/src/learningDesign/http/collaborationRoutes.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';
import {
  bankListingRequestSchema,
  bankListingSchema,
  bankListSchema,
  coAuthorAddRequestSchema,
  coAuthorListSchema,
  duplicateResponseSchema,
  peopleQuerySchema,
  peopleSearchResponseSchema,
} from '../collaboration.js';
import {
  badPeopleQuery,
  coAuthorParams,
  duplicateRefused,
  editorsOnly,
  ownerOnly,
  rateLimited,
  staffOnly,
  staffOwnerOnly,
} from './collaborationResponses.js';
import { contentParams, failure, unauthenticated, unavailable } from './routeResponses.js';

const COAUTHORS = '/content/:contentId/coauthors';
const BANK_LISTING = '/content/:contentId/bank';

/** The routes of this area, in the order of the OpenAPI document. */
export const COLLABORATION_ROUTES = [
  {
    operationId: 'searchPeople',
    method: 'get',
    path: '/people',
    auth: 'portal',
    summary:
      'Finds HVL staff who may be co-authors: at most 10 by part of their name, or exactly by Feide ID; never the ' +
      'asker; `{ userId, displayName }` only; the query is never logged (PROD-007, D-090).',
    query: peopleQuerySchema,
    responses: {
      200: { description: 'The people found.', schema: peopleSearchResponseSchema },
      400: badPeopleQuery,
      401: unauthenticated,
      403: staffOnly,
      429: rateLimited('too many searches in a minute'),
    },
  },
  {
    operationId: 'listCoAuthors',
    method: 'get',
    path: COAUTHORS,
    auth: 'portal',
    summary: 'An activity’s owner and co-authors, for people who may edit it (PROD-007, D-090).',
    params: contentParams,
    responses: {
      200: { description: 'The authors.', schema: coAuthorListSchema },
      401: unauthenticated,
      403: editorsOnly,
      404: unavailable,
    },
  },
  {
    operationId: 'addCoAuthor',
    method: 'post',
    path: COAUTHORS,
    auth: 'portal',
    summary:
      'Adds a person from people search as a co-author, as the owner; adding an existing co-author changes ' +
      'nothing; audited (PROD-007, D-090).',
    params: contentParams,
    body: coAuthorAddRequestSchema,
    responses: {
      200: { description: 'The authors after the change.', schema: coAuthorListSchema },
      400: failure(
        '`error.badRequest`: the body; `hvl:coauthor-not-eligible`: not findable HVL staff (the owner, a ' +
          'learner, a Canvas-only account, a student author, or no eligible Feide login for 13 months).',
      ),
      401: unauthenticated,
      403: staffOwnerOnly,
      404: unavailable,
      409: failure('`hvl:coauthor-limit`: the activity already has 20 co-authors.'),
    },
  },
  {
    operationId: 'removeCoAuthor',
    method: 'delete',
    path: `${COAUTHORS}/:userId`,
    auth: 'portal',
    summary:
      'Removes a co-author: the owner removes anyone, a co-author only themself; removing someone who is not one ' +
      'changes nothing; audited (PROD-007, D-090).',
    params: coAuthorParams,
    responses: {
      200: { description: 'The authors after the change.', schema: coAuthorListSchema },
      400: failure('`error.badRequest`: the user ID is not a UUID.'),
      401: unauthenticated,
      403: ownerOnly,
      404: unavailable,
    },
  },
  {
    operationId: 'getBankListing',
    method: 'get',
    path: BANK_LISTING,
    auth: 'portal',
    summary:
      'Whether the activity is in the HVL content bank, and whether it may be listed now (published, shared with ' +
      'HVL or wider, an owner who is HVL staff), for people who may edit it (PROD-007, D-091).',
    params: contentParams,
    responses: {
      200: { description: 'The listing.', schema: bankListingSchema },
      401: unauthenticated,
      403: editorsOnly,
      404: unavailable,
    },
  },
  {
    operationId: 'listInBank',
    method: 'put',
    path: BANK_LISTING,
    auth: 'portal',
    summary:
      'Lists the activity in the content bank as its owner, who accepted the consent text of `consentVersion`; ' +
      'listing a listed activity changes nothing; audited (PROD-007, D-091).',
    params: contentParams,
    body: bankListingRequestSchema,
    responses: {
      200: { description: 'The listing after the change.', schema: bankListingSchema },
      400: failure('`error.badRequest`: the body, or a consent version that is not the current one.'),
      401: unauthenticated,
      403: staffOwnerOnly,
      404: unavailable,
      409: failure('`hvl:bank-not-eligible`: not published, or not shared with HVL or wider.'),
    },
  },
  {
    operationId: 'unlistFromBank',
    method: 'delete',
    path: BANK_LISTING,
    auth: 'portal',
    summary:
      'Takes the activity out of the content bank as its owner; copies already made stay with their authors; ' +
      'audited (PROD-007, D-091).',
    params: contentParams,
    responses: {
      200: { description: 'The listing after the change.', schema: bankListingSchema },
      401: unauthenticated,
      403: ownerOnly,
      404: unavailable,
    },
  },
  {
    operationId: 'getBank',
    method: 'get',
    path: '/bank',
    auth: 'portal',
    summary:
      'The HVL content bank for HVL staff authors: published, listed activities the reader may view, newest ' +
      'listing first, with the owner’s name; never the rationale or the course code (PROD-007, D-091).',
    responses: {
      200: { description: 'The bank.', schema: bankListSchema },
      401: unauthenticated,
      403: staffOnly,
    },
  },
  {
    operationId: 'duplicateContent',
    method: 'post',
    path: '/content/:contentId/duplicate',
    auth: 'portal',
    summary:
      'Copies an activity the person may edit, or a bank activity, as their own private draft linked to its ' +
      'source; audited (PROD-007, D-092).',
    params: contentParams,
    responses: {
      201: { description: 'The copy.', schema: duplicateResponseSchema },
      400: failure('An editor refusal before anything was saved, e.g. an h5p.json Lumi’s schema refuses.'),
      401: unauthenticated,
      403: duplicateRefused,
      404: unavailable,
      429: rateLimited('more than 20 copies in ten minutes, «Lagre som ny versjon» included'),
      500: failure('`hvl:duplicate-failed`: the copy could not be made completely and was removed.'),
    },
  },
] as const satisfies readonly ApiRoute[];
