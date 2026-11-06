/**
 * canvasServices — wires the mock Canvas's LTI Advantage services (token endpoint, AGS line items and scores,
 * NRPS) and their fault queues onto its router, and builds the test controls `canvas.tokens`, `canvas.ags` and
 * `canvas.nrps`.
 *
 * Why: the grade bridge (LTI-012, D-104) and the participation count (LTI-008) talk to Canvas after the launch;
 *      the mock Canvas's launch claims already name these services, and this module serves them in memory.
 * Spec: LTI-008, LTI-012
 * Invariants:
 *   - The services keep everything in memory, per mock Canvas; nothing outlives `close()`.
 *   - The developer key grants `scopes` (default `MOCK_CANVAS_SCOPES`, exactly the scopes of
 *     docs/reference/canvas-lti13-developer-key.json); the launch claim's AGS scopes are the AGS ones among them.
 *   - A launch whose spec names a line item by ID gets that line item (label «Mock activity», `scoreMaximum` 100)
 *     unless it already exists or was deleted; every launched user joins the course roster.
 * Collaborators: ./mockCanvas.mjs, ./canvasTokenEndpoint.mjs, ./canvasLineItems.mjs, ./canvasScores.mjs,
 *   ./canvasMemberships.mjs, ./canvasFaults.mjs, ./canvasServiceControls.mjs, ./canvasServiceTypes.d.mts.
 * Tests: tools/mock-platform/test/canvasAgs.test.mjs, tools/mock-platform/test/canvasNrps.test.mjs,
 *   tools/mock-platform/test/canvasTokenEndpoint.test.mjs, tools/mock-platform/test/canvasServiceControls.test.mjs
 */
import { createFaultQueues } from './canvasFaults.mjs';
import { createLineItemStore, registerLineItemRoutes } from './canvasLineItems.mjs';
import { createMemberships, registerMembershipRoute } from './canvasMemberships.mjs';
import { createScoreService } from './canvasScores.mjs';
import { registerServiceControls } from './canvasServiceControls.mjs';
import { createTokenService } from './canvasTokenEndpoint.mjs';
import { LTI_SCOPE } from './ltiVocabulary.mjs';

/** The scopes the mock's developer key grants by default: HVL's developer key's three. */
export const MOCK_CANVAS_SCOPES = Object.freeze([
  LTI_SCOPE.lineItemReadonly,
  LTI_SCOPE.score,
  LTI_SCOPE.contextMembershipReadonly,
]);

/**
 * Checks the scopes a mock Canvas's developer key grants.
 * @param {unknown} scopes - A list of scope URIs, or undefined for `MOCK_CANVAS_SCOPES`.
 * @returns {readonly string[]} The scopes.
 * @throws {TypeError} For an empty list or a scope that is not an AGS or NRPS scope.
 */
export function developerKeyScopes(scopes = MOCK_CANVAS_SCOPES) {
  const known = Object.values(LTI_SCOPE);
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every((scope) => known.includes(scope))) {
    throw new TypeError(`scopes must be a non-empty list of: ${known.join(' ')}`);
  }
  return Object.freeze([...new Set(scopes)]);
}

/**
 * Serves the services on a mock Canvas's router and returns their controls.
 * @param {{add: Function}} router - The mock Canvas router.
 * @param {{origin: string, clientId: string, toolUrl: string, tokenEndpoint: string, scopes: readonly string[]}}
 *   platform - The mock Canvas, its token endpoint URL and its developer key's scopes.
 * @returns {{tokens: object, ags: object, nrps: object, onLaunchSpec: Function, onLaunch: Function}} The controls
 *   (see `MockCanvasTokens`, `MockCanvasAgs` and `MockCanvasNrps` in ./canvasServiceTypes.d.mts) and two hooks:
 *   `onLaunchSpec(launch)` for every normalised launch spec, `onLaunch(launch)` for every ID token issued.
 */
export function createCanvasServices(router, platform) {
  const faults = createFaultQueues();
  const tokenService = createTokenService(platform, faults);
  const store = createLineItemStore(platform.origin);
  const memberships = createMemberships();
  const scoreService = createScoreService({ store, memberships, tokens: tokenService, faults });
  const services = { tokens: tokenService, faults, origin: platform.origin };
  router.add('POST', '/login/oauth2/token', tokenService.handle);
  registerLineItemRoutes(router, { ...services, store });
  router.add('POST', '/api/lti/courses/:course/line_items/:id/scores', scoreService.handle);
  registerMembershipRoute(router, { ...services, memberships });
  const controls = {
    tokens: {
      requests: tokenService.requests,
      revokeAll: tokenService.revokeAll,
      failNext: (fault) => void faults.add('token', fault),
    },
    ags: {
      scores: scoreService.scores,
      scorePosts: scoreService.scorePosts,
      lineItems: (courseId) => store.list(courseId),
      addLineItem: ({ courseId = 'mock-course-1', ...spec }) => store.add(courseId, spec),
      deleteLineItem: (url) => store.remove(url),
      failNextScores: (fault) => void faults.add('scores', fault),
      failNextLineItemReads: (fault) => void faults.add('lineItems', fault),
    },
    nrps: {
      members: (courseId) => memberships.members(courseId),
      setMembers: (courseId, members) => memberships.setMembers(courseId, members),
      failNext: (fault) => void faults.add('memberships', fault),
    },
    clearFaults: () => faults.clear(),
  };
  registerServiceControls(router, { ...controls, faults });
  return {
    ...controls,
    onLaunchSpec(launch) {
      const { lineItem, course, resourceLinkId } = launch;
      if (lineItem !== undefined && !/^https?:/.test(lineItem))
        store.ensure(course.id, lineItem, resourceLinkId);
    },
    onLaunch: (launch) => memberships.enrol(launch),
  };
}
