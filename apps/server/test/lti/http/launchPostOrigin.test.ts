/**
 * Unit tests of the rule that the last step of a launch comes from our own page (D-141): which post is the last
 * step, which headers say "our own page", and how ltijs's routes on our router apply it: the last step is refused
 * before ltijs reads it, Canvas's own cross-site post is not judged, and only ltijs's launch page carries the
 * referrer rule that lets a browser name our origin.
 *
 * Spec: LTI-001, LTI-003
 */
import express from 'express';
import { HttpMethod, type RouteHandler } from 'ltijs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ExpressRouterHttpHandler } from '../../../src/lti/http/ExpressRouterHttpHandler.js';
import {
  RECOVERED_STATE_FIELD,
  assertLastStepFromOwnPage,
  isFromOwnPage,
  isLastLaunchStep,
} from '../../../src/lti/http/launchPostOrigin.js';

const OWN = 'https://interaktiv.hvl.no';
const LAST_STEP = { id_token: 'x', state: 's', [RECOVERED_STATE_FIELD]: 'recovery-token' };

describe('[LTI-001] which request is the last step of a launch, and whose page sent it', () => {
  it('[LTI-001] a post with a recovery token as text is the last step; Canvas’s own post is not', () => {
    expect(isLastLaunchStep(LAST_STEP)).toBe(true);
    expect(isLastLaunchStep({ id_token: 'x', state: 's' })).toBe(false);
    // WHY: as ltijs reads it: a repeated field is a list, which ltijs does not take as a recovery token either.
    expect(isLastLaunchStep({ ...LAST_STEP, [RECOVERED_STATE_FIELD]: ['a', 'b'] })).toBe(false);
  });

  it.each([
    [{ 'sec-fetch-site': 'same-origin' }, true],
    [{ 'sec-fetch-site': 'same-origin', origin: 'https://other.example' }, true],
    [{ 'sec-fetch-site': 'cross-site', origin: OWN }, false],
    [{ 'sec-fetch-site': 'same-site', origin: OWN }, false],
    [{ 'sec-fetch-site': 'none' }, false],
    [{ origin: OWN }, true],
    [{ origin: 'https://other.example' }, false],
    [{ origin: 'null' }, false],
    [{ origin: `${OWN}/` }, false],
    [{ origin: 'https://interaktiv.hvl.no.other.example' }, false],
    [{ origin: [OWN, OWN] }, false],
    [{}, false],
  ] as const)('[LTI-001] headers %j say "our own page": %s', (headers, expected) => {
    expect(isFromOwnPage(headers, OWN)).toBe(expected);
  });

  it('[LTI-001] the last step from elsewhere is refused as an invalid state; any other post is not judged', () => {
    expect(() => assertLastStepFromOwnPage(LAST_STEP, { origin: 'https://other.example' }, OWN)).toThrow(
      'INVALID_STATE',
    );
    expect(() => assertLastStepFromOwnPage(LAST_STEP, {}, OWN)).toThrow('INVALID_STATE');
    expect(() => assertLastStepFromOwnPage(LAST_STEP, { origin: OWN }, OWN)).not.toThrow();
    expect(() => assertLastStepFromOwnPage({ id_token: 'x', state: 's' }, {}, OWN)).not.toThrow();
  });
});

describe('[LTI-001] ltijs’s routes on our router apply the rule', () => {
  /** ltijs's launch route on our router, with a handler that says it ran, and an error handler like the app's. */
  const appWith = (before?: express.RequestHandler) => {
    const seen: string[] = [];
    const handler: RouteHandler = async (req, res) => {
      seen.push(req.path);
      res.html('<form></form>');
    };
    const launch = { route: '/lti/launch', ownOrigin: OWN, ...(before ? { before } : {}) };
    const http = new ExpressRouterHttpHandler(['https://hvl.instructure.com'], launch);
    http.registerRoute('/lti/launch', [HttpMethod.Post], handler);
    http.registerRoute('/lti/login', [HttpMethod.Get, HttpMethod.Post], handler);
    const app = express();
    app.use(http.router);
    app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(418).send(`refused: ${error.message}`);
    });
    return { app, seen };
  };
  const post = (app: express.Express, path: string, form: object, headers: Record<string, string> = {}) =>
    request(app).post(path).set(headers).type('form').send(form);

  it('[LTI-001] the last step without fetch metadata and without our Origin never reaches ltijs', async () => {
    // Arrange
    const { app, seen } = appWith();
    // Act
    const answers = [
      await post(app, '/lti/launch', LAST_STEP),
      await post(app, '/lti/launch', LAST_STEP, { Origin: 'https://other.example' }),
      await post(app, '/lti/launch', LAST_STEP, { Origin: 'null' }),
      await post(app, '/lti/launch', LAST_STEP, { 'Sec-Fetch-Site': 'cross-site', Origin: OWN }),
    ];
    // Assert
    expect(answers.map((res) => [res.status, res.text])).toEqual(
      Array.from({ length: 4 }, () => [418, 'refused: INVALID_STATE']),
    );
    expect(seen).toEqual([]);
  });

  it('[LTI-001] the last step from our own page, and Canvas’s cross-site first post, reach ltijs', async () => {
    // Arrange
    const { app, seen } = appWith();
    // Act
    const answers = [
      await post(app, '/lti/launch', LAST_STEP, { Origin: OWN }),
      await post(app, '/lti/launch', LAST_STEP, { 'Sec-Fetch-Site': 'same-origin' }),
      await post(app, '/lti/launch', { id_token: 'x', state: 's' }, { 'Sec-Fetch-Site': 'cross-site' }),
      // WHY: the rule is the launch route's alone; the login route takes a recovery-token field as any field.
      await post(app, '/lti/login', LAST_STEP),
    ];
    // Assert
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200, 200]);
    expect(seen).toEqual(['/lti/launch', '/lti/launch', '/lti/launch', '/lti/login']);
  });

  it('[LTI-003] only ltijs’s launch page is `same-origin`; its login page stays `no-referrer`', async () => {
    // Arrange
    const { app } = appWith();
    // Act
    const launchPage = await post(app, '/lti/launch', { id_token: 'x', state: 's' });
    const loginPage = await post(app, '/lti/login', { iss: 'x' });
    // Assert
    expect(launchPage.headers['referrer-policy']).toBe('same-origin');
    expect(loginPage.headers['referrer-policy']).toBe('no-referrer');
    expect(launchPage.headers['cache-control']).toBe('no-store');
  });

  it('[LTI-001] what runs before the routes sees a request first, and its refusal stops it unread', async () => {
    // Arrange: a stand-in for the request ceiling that refuses everything
    const order: string[] = [];
    const { app, seen } = appWith((req, _res, next) => {
      order.push(`before:${String(req.body === undefined)}`);
      next(new Error('over the ceiling'));
    });
    // Act
    const res = await post(app, '/lti/login', { iss: 'x' });
    // Assert: it ran before the body was parsed, and ltijs's handler never ran
    expect([res.status, res.text]).toEqual([418, 'refused: over the ceiling']);
    expect(order).toEqual(['before:true']);
    expect(seen).toEqual([]);
  });
});
