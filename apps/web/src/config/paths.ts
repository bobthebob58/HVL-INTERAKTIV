/**
 * paths — every address the web app links to: its own pages, Express's login and logout, and the H5P pages it frames.
 *
 * Why: links and frames must name the same addresses Express serves (D-067, D-068); one list keeps them consistent
 *      and keeps addresses out of the markup, where they would read as user-facing text (DOC-009 lint).
 * Spec: UD-013, DATA-006, AUTH-001, LTI-006
 * Invariants:
 *   - Every path is same-origin; an activity ID is percent-encoded into its path.
 *   - The ltik goes only into the two LTI frame addresses, as Express accepts it there (D-069).
 * Collaborators: ../components/*, ../features/*, apps/server/src/web/webRoutes.ts, apps/server/src/http/routes/*.
 * Tests: apps/web/test/config/paths.test.ts
 */

/** The portal's start page. */
export const HOME_PATH = '/';
/** The help page (UD-013). */
export const HELP_PATH = '/hjelp';
/** The privacy notice (DATA-006). */
export const PRIVACY_PATH = '/personvern';
/** The new-activity page. */
export const NEW_ACTIVITY_PATH = '/aktivitet/ny';
/** Express's Feide login (apps/server/src/auth/feide/feideLoginRoutes.ts). */
export const LOGIN_PATH = '/auth/feide/login';
/** Express's logout, a POST with the CSRF token (D-057). */
export const LOGOUT_PATH = '/auth/logout';
/** Express's editor page for a new activity (apps/server/src/http/routes/editorRoutes.ts). */
export const NEW_EDITOR_PATH = '/h5p/new';

const encoded = (contentId: string): string => encodeURIComponent(contentId);

/**
 * The activity page.
 * @param contentId - The activity.
 * @returns `/aktivitet/<id>`.
 */
export const activityPath = (contentId: string): string => `/aktivitet/${encoded(contentId)}`;

/**
 * Express's player page for an activity in the portal.
 * @param contentId - The activity.
 * @returns `/h5p/play/<id>`.
 */
export const playerPath = (contentId: string): string => `/h5p/play/${encoded(contentId)}`;

/**
 * Express's editor page for an activity in the portal.
 * @param contentId - The activity.
 * @returns `/h5p/edit/<id>`.
 */
export const editorPath = (contentId: string): string => `/h5p/edit/${encoded(contentId)}`;

/**
 * Express's player or editor page for the activity of a Canvas launch.
 * @param page - `play` or `edit`.
 * @param ltik - The launch's ltik, kept in page memory.
 * @returns `/lti/play?ltik=…` or `/lti/edit?ltik=…`.
 */
export const ltiFramePath = (page: 'play' | 'edit', ltik: string): string =>
  `/lti/${page}?ltik=${encodeURIComponent(ltik)}`;

/**
 * The Feide login link for a page.
 * @param returnTo - The local path to come back to; omitted for the start page.
 * @returns The login URL.
 */
export const loginHref = (returnTo?: string): string =>
  returnTo && returnTo !== HOME_PATH ? `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}` : LOGIN_PATH;
