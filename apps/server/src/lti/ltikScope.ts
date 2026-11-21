/**
 * ltikScope — what a request that carries an ltik may ask for, by the kind of launch the ltik continues.
 *
 * Why: an ltik is a bearer token that lives for a day, in a frame where no cookie works (LTI-003). The Canvas
 *      pages need only the activity a launch opened, or the Deep Linking picker. An ltik that could also list,
 *      create, delete, download or share would make one that leaks worth the author's whole account, so the
 *      token is held to what its own pages ask for; everything else stays behind the portal's Feide session
 *      (D-130).
 * Spec: LTI-003, LTI-004, LTI-006, PROD-007
 * Invariants:
 *   - Default deny: a method and path that is not listed for the launch's kind is refused, so a new route is
 *     closed to ltiks until it is listed here.
 *   - A resource-link launch reaches only its own activity: the ID in the path must be the launch's `contentId`
 *     (compared without regard to case). A launch that opened no activity reaches no activity route.
 *   - A Deep Linking launch reaches no activity route. Its picker and its answer are LTI routes that resolve the
 *     ltik themselves (./deepLinking/deepLinkRoutes.ts) and are not asked about here.
 *   - Listing, creating, deleting, downloading, copying, publishing, unpublishing and sharing are on no list.
 *   - A route the API contract marks `auth: 'none'` answers a request with an ltik as it answers one without.
 *   - Each route's own role and permission checks still run; this list only narrows what reaches them.
 *   - `HEAD` is judged as `GET`; one trailing slash is ignored, as Express ignores it.
 * Collaborators: ../auth/requestPrincipal.ts (asks for every request that carries an ltik), ../auth/Principal.ts.
 * Tests: apps/server/test/lti/ltikScope.test.ts, apps/server/test/lti/ltikScope.int.test.ts
 */
import { API_ROUTES } from '@hvl-interaktiv/api-contract';
import type { Principal } from '../auth/Principal.js';

/** One allowed request: its methods, and its path; a group named `id` must be the launched activity. */
type Allowed = readonly [methods: readonly string[], path: RegExp];

const GET = ['GET'] as const;
const READ_AND_WRITE = ['GET', 'POST'] as const;

/** What anyone may read without signing in (the contract's `auth: 'none'` routes, D-089): a token changes nothing. */
const PUBLIC: readonly Allowed[] = API_ROUTES.filter((route) => route.auth === 'none').map((route) => [
  [route.method.toUpperCase()],
  new RegExp(`^/api${route.path.replace(/:[A-Za-z]+/g, '[^/]+')}$`),
]);

/** What every launch may ask: who it is, and that a notice was read (`/api/me`). */
const ANY_LAUNCH: readonly Allowed[] = [
  [GET, /^\/api\/me$/],
  [['PUT'], /^\/api\/me\/notices\/[^/]+$/],
];

/** What a resource-link launch may ask, all of it about the activity it opened. */
const RESOURCE_LINK: readonly Allowed[] = [
  // The player: the learner's saved state and the answers sent for insight and grades.
  [READ_AND_WRITE, /^\/h5p\/contentUserData\/(?<id>[^/]+)\/[^/]+\/[^/]+$/],
  // WHY: `0` is H5P's own ID for "no activity yet" in a state URL; the state routes answer it with nothing stored.
  [READ_AND_WRITE, /^\/h5p\/contentUserData\/0\/[^/]+\/[^/]+$/],
  [['POST'], /^\/api\/h5p\/xapi$/],
  // The editor inside Canvas (LTI-006 «Rediger»): its own AJAX, the stored parameters, the save and what blocks it.
  [READ_AND_WRITE, /^\/h5p\/ajax$/],
  [GET, /^\/h5p\/params\/(?<id>[^/]+)$/],
  [['PUT'], /^\/h5p\/content\/(?<id>[^/]+)$/],
  [GET, /^\/api\/content\/(?<id>[^/]+)\/findings$/],
  // The author's tabs in Canvas: insight and the scores sent to Canvas, for the launch's course.
  [GET, /^\/api\/content\/(?<id>[^/]+)\/insight(?:\/(?:contexts|export|findings))?$/],
  [GET, /^\/api\/content\/(?<id>[^/]+)\/grade-sync$/],
  [['POST'], /^\/api\/content\/(?<id>[^/]+)\/grade-sync\/retry$/],
];

/** The LTI message type of a launch that opens an activity. */
const RESOURCE_LINK_REQUEST = 'LtiResourceLinkRequest';

const matches = (rules: readonly Allowed[], method: string, path: string, launched?: string): boolean =>
  rules.some(([methods, pattern]) => {
    if (!methods.includes(method)) return false;
    const found = pattern.exec(path);
    if (!found) return false;
    const id = found.groups?.id;
    // SECURITY: an ID in the path is the launch's own activity or the request is not on the list (D-130).
    return id === undefined || id.toLowerCase() === launched?.toLowerCase();
  });

/**
 * Tells whether a request that carries an ltik is one its launch's pages make.
 * @param launch - The launch the ltik continues (`Principal.lti`).
 * @param method - The request's method.
 * @param path - The request's full, decoded path, without the query.
 * @returns True when the method and path are listed for the launch's kind.
 * @spec LTI-003
 */
export function ltikScopeAllows(
  launch: Pick<NonNullable<Principal['lti']>, 'messageType' | 'contentId'> | undefined,
  method: string,
  path: string,
): boolean {
  const verb = method === 'HEAD' ? 'GET' : method;
  const route = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  if (matches(PUBLIC, verb, route) || matches(ANY_LAUNCH, verb, route)) return true;
  if (launch?.messageType !== RESOURCE_LINK_REQUEST) return false;
  return matches(RESOURCE_LINK, verb, route, launch.contentId);
}
