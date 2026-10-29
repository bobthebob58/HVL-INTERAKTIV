/**
 * studioRoutes — the registry of the public studio routes under `/api`: the overview (the phases, the *samling*
 * anchor and the pattern catalogue), the guide in one language, and one pattern's detail.
 *
 * Why: D-099 splits the `/api` registry by area, so each area's routes are in its own table and a change to one area
 *      never edits another's; ../apiRoutes.ts concatenates the areas in document order.
 * Spec: DOC-012, PED-001, PED-002, PED-003, PED-011
 * Invariants:
 *   - `path` is below `/api`, in Express form; every `:name` has a schema in `params`, every query parameter one in
 *     `query`, and every schema a route names is listed in ./studioSchemaNames.ts.
 *   - Every signed-in route documents 401 (./routeResponses.ts has the shared answers).
 *   - Studio routes are public (`auth: 'none'`, D-089) and answer only content from `content/`, never data about
 *     people.
 * Collaborators: ./routeResponses.ts, ./studioSchemaNames.ts, ../studio.ts, ../guideNodes.ts, ../patterns.ts,
 *   ../apiRoutes.ts, apps/server/src/learningDesign/http/studioContentRoutes.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import type { ApiRoute } from '../apiRouteTypes.js';
import { patternParamsSchema } from '../patterns.js';
import { guideParamsSchema, guideSchema, patternDetailSchema, studioOverviewSchema } from '../studio.js';
import { failure } from './routeResponses.js';

/** The routes of this area, in the order of the OpenAPI document. */
export const STUDIO_ROUTES = [
  {
    operationId: 'getStudioOverview',
    method: 'get',
    path: '/studio',
    auth: 'none',
    summary:
      'The studio’s review status, the three phases with their texts, the *samling* anchor and the pattern ' +
      'catalogue, each card saying whether it can be created now (PED-001, PED-003, D-085).',
    responses: {
      200: {
        description: 'The overview, from the content loaded at start-up.',
        schema: studioOverviewSchema,
      },
    },
  },
  {
    operationId: 'getStudioGuide',
    method: 'get',
    path: '/studio/guide/:locale',
    auth: 'none',
    summary:
      'The guide in one language as a closed node tree, with the references it cites; empty while no guide is ' +
      'written yet (PED-002, D-083).',
    params: guideParamsSchema,
    responses: {
      200: { description: 'The guide.', schema: guideSchema },
      404: failure('`error.notFound`: the language is not nn, nb or en.'),
    },
  },
  {
    operationId: 'getPatternDetail',
    method: 'get',
    path: '/studio/patterns/:patternId',
    auth: 'none',
    summary:
      'One pattern’s page: its card, when to use it, why it works (with citations), an example, the student ' +
      'minutes and the references it cites (PED-010, PED-011).',
    params: patternParamsSchema,
    responses: {
      200: { description: 'The pattern.', schema: patternDetailSchema },
      404: failure('`error.notFound`: there is no pattern with this ID (a malformed ID alike).'),
    },
  },
] as const satisfies readonly ApiRoute[];
