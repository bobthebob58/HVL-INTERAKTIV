/**
 * Tests that ltijs's routes run on our Express router with our headers, request shape and error path.
 *
 * Spec: LTI-001, LTI-003
 */
import express from 'express';
import { HttpMethod, type HttpRequestParameters, type RouteHandler } from 'ltijs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  ExpressRouterHttpHandler,
  STORAGE_GUARD_SCRIPT,
} from '../../../src/lti/http/ExpressRouterHttpHandler.js';

const CANVAS = ['https://hvl.instructure.com'];

const appWith = (path: string, methods: HttpMethod[], handler: RouteHandler) => {
  const http = new ExpressRouterHttpHandler(CANVAS);
  http.registerRoute(path, methods, handler);
  const app = express();
  app.use(http.router);
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(418).send(`handled: ${error.message}`);
  });
  return app;
};

describe('[LTI-001] ltijs on our router', () => {
  it('[LTI-001] passes method, path, query, form body and lower-case headers to ltijs', async () => {
    // Arrange
    const seen: HttpRequestParameters[] = [];
    const app = appWith('/lti/launch', [HttpMethod.Post], async (req, res) => {
      seen.push(req);
      res.json({ ok: true });
    });
    // Act
    await request(app)
      .post('/lti/launch?a=1')
      .set('Sec-Fetch-Site', 'cross-site')
      .type('form')
      .send({ id_token: 'x', state: 's' });
    // Assert
    expect(seen[0]).toMatchObject({
      method: 'POST',
      path: '/lti/launch',
      query: { a: '1' },
      body: { id_token: 'x', state: 's' },
      headers: { 'sec-fetch-site': 'cross-site' },
    });
  });

  it('[LTI-003] sends ltijs HTML with our storage guard first and the LTI headers', async () => {
    // Arrange
    const app = appWith('/lti/login', [HttpMethod.Get, HttpMethod.Post], async (_req, res) => {
      res.html('<script>go();</script>');
    });
    // Act
    const res = await request(app).get('/lti/login');
    // Assert
    expect(res.text.startsWith(`<script src="${STORAGE_GUARD_SCRIPT}"></script>`)).toBe(true);
    expect(res.headers).toMatchObject({
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    expect(res.headers['content-security-policy']).toContain('frame-ancestors https://hvl.instructure.com');
    expect(res.headers['x-frame-options']).toBeUndefined();
    expect((await request(app).post('/lti/login')).status).toBe(200);
  });

  it('[LTI-003] a redirect carrying the ltik is no-referrer and no-store', async () => {
    const app = appWith('/lti/launch', [HttpMethod.Post], async (_req, res) =>
      res.redirect('/lti/play?ltik=abc'),
    );
    const res = await request(app).post('/lti/launch');
    expect(res.status).toBe(302);
    expect(res.headers).toMatchObject({ 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' });
  });

  it('[LTI-001] hands a handler error to the next error handler, and only registers the given methods', async () => {
    // Arrange
    const app = appWith('/lti/keys', [HttpMethod.Get], async () => {
      throw new Error('boom');
    });
    // Act and assert
    expect((await request(app).get('/lti/keys')).text).toBe('handled: boom');
    expect((await request(app).post('/lti/keys')).status).toBe(404);
  });

  it('[LTI-001] listen and close do nothing', async () => {
    const http = new ExpressRouterHttpHandler([]);
    await expect(http.listen()).resolves.toBeUndefined();
    await expect(http.close()).resolves.toBeUndefined();
  });
});
