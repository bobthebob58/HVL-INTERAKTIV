/**
 * ltiStaticScripts — where the LTI pages' own browser scripts are served, by name.
 *
 * Why: the player page, the editor page and the LTI error pages all load scripts from `./client/`. The paths
 *      live here, in a module that imports nothing, so the error pages can name the landing script without
 *      importing the routes that serve the pages (which import the error pages themselves).
 * Spec: LTI-003
 * Invariants:
 *   - Every path is a same-origin static file under `LTI_STATIC_PATH`; the pages' policies allow no other script.
 * Collaborators: ../play/ltiPlayRoutes.ts (serves the folder and re-exports the paths), ../play/ltiEditRoutes.ts,
 *   ../http/ltiErrorPages.ts, ./client/ltikLanding.js, ./client/h5pStorageGuard.js.
 * Tests: apps/server/test/lti/http/ltiErrorPages.test.ts, apps/server/test/lti/pages/ltikLanding.test.ts
 */

/** Where the LTI pages' static scripts are served. */
export const LTI_STATIC_PATH = '/static/lti';
/** The script that removes the ltik from the address bar (./client/ltikLanding.js). */
export const LTIK_LANDING_SCRIPT = `${LTI_STATIC_PATH}/ltikLanding.js`;
/** The script that keeps H5P Core working where frame storage is blocked (./client/h5pStorageGuard.js). */
export const H5P_STORAGE_GUARD_SCRIPT = `${LTI_STATIC_PATH}/h5pStorageGuard.js`;
