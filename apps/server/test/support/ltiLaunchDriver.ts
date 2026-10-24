/**
 * ltiLaunchDriver — runs an LTI 1.3 launch from the mock Canvas through the app's real ltijs routes, the way a
 * browser would, without a browser.
 *
 * Why: LTI-001's acceptance is "a launch from the mock platform reaches the tool"; integration tests need it many
 *      times, with variations (a tampered token, a replay, another deployment). The steps are: login initiation →
 *      ltijs's login page (its embedded data says where to go) → the platform's authorisation endpoint → the
 *      `form_post` to `/lti/launch` → ltijs's own second POST with the recovered state.
 * Spec: LTI-001, LTI-003
 * Invariants:
 *   - Uses only public HTTP: the app is driven with supertest, the mock Canvas through its own API.
 *   - Nothing is stored between launches; each call starts a fresh login at the platform.
 * Collaborators: ./appTestbed.ts, ../../../../tools/mock-platform/mockCanvas.mjs.
 * Tests: apps/server/test/lti/ltiLaunch.int.test.ts, apps/server/test/lti/deepLinking/deepLinking.int.test.ts
 */
import type { Express } from 'express';
import request, { type Response } from 'supertest';
import type { LaunchSpec, MockCanvas } from '../../../../tools/mock-platform/mockPlatform.mjs';

/** One launch as it went. */
export interface DrivenLaunch {
  /** The answer to ltijs's second launch POST: a redirect on success, an error page otherwise. */
  readonly res: Response;
  /** The ltik the redirect carries, if any. */
  readonly ltik: string | undefined;
  /** The redirect's path, e.g. `/lti/play`. */
  readonly path: string | undefined;
  /** Posts the same final launch form again (a replay). */
  replay(): Promise<Response>;
}

/** How to change the platform's ID token before it is posted (for negative tests). */
export type IdTokenTamper = (idToken: string, canvas: MockCanvas) => Promise<string>;

const embedded = (html: string, id: string): Record<string, string> =>
  JSON.parse(new RegExp(`id="${id}">(.*?)</script>`, 's').exec(html)?.[1] ?? '{}') as Record<string, string>;

/**
 * Launches from the mock Canvas.
 * @param app - The app under test.
 * @param canvas - The mock Canvas.
 * @param spec - Who launches what (see `LaunchSpec`).
 * @param tamper - Optionally replaces the ID token before it is posted.
 * @returns The final response, the ltik and a replay function.
 * @throws Error when the platform refuses the authentication request (a broken test, not a tool answer).
 */
export async function launchFromCanvas(
  app: Express,
  canvas: MockCanvas,
  spec: LaunchSpec = {},
  tamper?: IdTokenTamper,
): Promise<DrivenLaunch> {
  const login = await request(app).post('/lti/login').type('form').send(canvas.loginInitiation(spec));
  const { targetUrl, recoveryToken } = embedded(login.text, 'ltijs-login-data');
  if (!targetUrl) throw new Error(`no login data in the ltijs login page (status ${login.status})`);
  const answer = await canvas.authorize(targetUrl);
  if (!('idToken' in answer)) throw new Error(`the mock Canvas refused the login: ${answer.error}`);
  const idToken = tamper ? await tamper(answer.idToken, canvas) : answer.idToken;
  const path = new URL(answer.action).pathname;
  const form = { id_token: idToken, state: answer.state };
  const first = await request(app).post(path).type('form').send(form);
  // WHY: ltijs answers the platform's cross-site POST with a page that posts again with the recovered state.
  const finalForm = { ...form, ltijs_recovered_state: recoveryToken ?? '' };
  const post = () => request(app).post(path).type('form').send(finalForm);
  const res = first.status >= 300 && first.status < 400 ? first : await post();
  const location = typeof res.headers.location === 'string' ? res.headers.location : undefined;
  const target = location ? new URL(location, 'http://tool.invalid') : undefined;
  return {
    res,
    ltik: target?.searchParams.get('ltik') ?? undefined,
    path: target?.pathname,
    replay: post,
  };
}
