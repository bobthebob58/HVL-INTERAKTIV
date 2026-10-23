/**
 * appLaunch — what Express tells the web app's LTI chrome page (`/app/play`) about the launch it serves.
 *
 * Why: the web app never sees the ltik or any credential (D-068), but its Canvas page must know which activity the
 *      launch opened, its title and whether the person may edit it (the **Rediger** tab, LTI-006). Express resolves
 *      the ltik first (../lti/play/appLaunchRoutes.ts) and hands these facts over in one request header it always
 *      overwrites, so a client cannot forge them (./webRequestContract.ts removes every client-sent `x-hvli-*`).
 * Spec: LTI-006, LTI-003, D-069
 * Invariants:
 *   - The header value is `encodeURIComponent(JSON.stringify(launch))`: header values must be Latin-1, titles are not.
 *   - It carries no token, no user ID and no learner data: activity ID, title, the Edit decision and the locale.
 * Collaborators: ../lti/play/appLaunchRoutes.ts (sets it), ./webRoutes.ts (forwards it), apps/web's `/app/play` page.
 * Tests: apps/server/test/web/webRoutes.int.test.ts, apps/server/test/lti/appLaunch.int.test.ts
 */
import type { Response } from 'express';
import type { Locale } from '../i18n/translate.js';

/** The request header that carries the launch to the web app (same name in apps/web). */
export const LAUNCH_HEADER = 'x-hvli-launch';

const LOCALS_KEY = 'hvliAppLaunch';

/** The launch facts the chrome page needs. */
export interface AppLaunch {
  readonly contentId: string;
  readonly title: string;
  /** The launch's person may edit the activity (H5P-006 Edit for the account view). */
  readonly mayEdit: boolean;
  readonly locale: Locale;
}

/**
 * Records the launch on the response, for ./webRoutes.ts.
 * @param res - The response of a `/app/play` request.
 * @param launch - The resolved launch facts.
 */
export function setAppLaunch(res: Response, launch: AppLaunch): void {
  res.locals[LOCALS_KEY] = Object.freeze({ ...launch });
}

/**
 * The launch recorded on a response, if any.
 * @param res - The response.
 * @returns The launch facts, or undefined outside `/app/play`.
 */
export const appLaunchOf = (res: Response): AppLaunch | undefined =>
  res.locals[LOCALS_KEY] as AppLaunch | undefined;

/**
 * The header value for a launch.
 * @param launch - The launch facts.
 * @returns The percent-encoded JSON.
 */
export const launchHeaderValue = (launch: AppLaunch): string => encodeURIComponent(JSON.stringify(launch));
