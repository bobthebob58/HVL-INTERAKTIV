/**
 * Tests that the LTI error handler's log line names the route pattern, the status, the request ID and a fixed code,
 * and that text a client chose (a crafted path under `/static/lti`, a path segment, a query, a malformed JSON body)
 * never reaches the log, while an unexpected error is still logged for operations.
 *
 * Spec: NFR-006, DATA-009
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express, { Router } from 'express';
import { LtijsError } from 'ltijs';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { authError } from '../../../src/http/authErrors.js';
import { requestLog } from '../../../src/http/requestLog.js';
import { ltiErrorLogFields, ltiRouteLabel } from '../../../src/lti/http/ltiErrorLog.js';
import { ltiErrorPages } from '../../../src/lti/http/ltiErrorPages.js';
import { capturedLogger } from '../../support/capturedLogger.js';

const MARKER = 'crafted-Kari-Nordmann-0xC0FFEE';
const staticRoot = mkdtempSync(join(tmpdir(), 'lti-static-'));
afterAll(() => rmSync(staticRoot, { recursive: true, force: true }));

/** The LTI router as ltiRoutes.ts builds it, in small: static files, a body parser, routes, the error pages. */
function ltiApp() {
  const { logger, lines } = capturedLogger('info');
  const router = Router();
  router.use('/static/lti', express.static(staticRoot, { index: false, fallthrough: false, maxAge: 0 }));
  router.use(express.json());
  router.get('/lti/thing/:contentId', () => {
    throw authError('hvl:activity-unavailable');
  });
  router.post('/lti/api', () => {
    throw new Error('not reached');
  });
  router.get('/lti/launch-like', () => {
    throw new LtijsError('INVALID_NONCE_RECEIVED');
  });
  router.get('/lti/boom', () => {
    throw new Error('connect ECONNREFUSED db:5432');
  });
  router.use(ltiErrorPages({ canvasOrigins: [], logger, audit: { record: async () => undefined } }));
  const app = express();
  app.use(requestLog(logger));
  app.use(router);
  const refusals = () =>
    lines.map((line) => JSON.parse(line)).filter((entry) => entry.msg === 'LTI request refused');
  return { app, lines, refusals };
}

describe('[NFR-006] the LTI error log line', () => {
  it('[NFR-006][DATA-009] a crafted path under /static/lti is logged as a 404 by status, never by its text', async () => {
    // Arrange
    const { app, lines, refusals } = ltiApp();
    // Act
    const res = await request(app).get(`/static/lti/${MARKER}.js?ltik=${MARKER}`);
    // Assert
    expect(res.status).toBe(404);
    expect(refusals()).toEqual([
      {
        level: 'warn',
        time: expect.any(String),
        service: expect.any(String),
        msg: 'LTI request refused',
        route: '*',
        status: 404,
        requestId: res.headers['x-request-id'],
      },
    ]);
    expect(lines.join('')).not.toContain(MARKER);
    expect(lines.join('')).not.toContain(staticRoot);
  });

  it('[NFR-006][DATA-009] a refusal on a route is logged by its pattern and fixed code, not its path or query', async () => {
    // Arrange
    const { app, lines, refusals } = ltiApp();
    // Act
    const res = await request(app).get(`/lti/thing/${MARKER}?ltik=${MARKER}`);
    // Assert
    expect(res.status).toBe(404);
    expect(refusals()).toEqual([
      expect.objectContaining({
        route: '/lti/thing/:contentId',
        status: 404,
        code: 'hvl:activity-unavailable',
      }),
    ]);
    expect(lines.join('')).not.toContain(MARKER);
  });

  it('[NFR-006][DATA-009] a malformed JSON body is logged as a 400 by status, never with the body it quoted', async () => {
    const { app, lines, refusals } = ltiApp();
    const res = await request(app)
      .post('/lti/api')
      .set('Content-Type', 'application/json')
      .send(`{"name": "${MARKER}`);
    expect(res.status).toBe(400);
    expect(refusals()).toEqual([expect.objectContaining({ route: '*', status: 400 })]);
    expect(refusals()[0]).not.toHaveProperty('err');
    expect(lines.join('')).not.toContain(MARKER);
  });

  it('[NFR-006] an ltijs refusal is logged by its code; an unexpected error keeps its (redacted) error', async () => {
    const { app, refusals } = ltiApp();
    await request(app).get('/lti/launch-like');
    await request(app).get('/lti/boom');
    const [ltijs, unexpected] = refusals();
    expect(ltijs).toMatchObject({ route: '/lti/launch-like', status: 400, code: 'INVALID_NONCE_RECEIVED' });
    expect(ltijs).not.toHaveProperty('err');
    expect(unexpected).toMatchObject({ level: 'error', route: '/lti/boom', status: 500 });
    expect(unexpected.err.message).toBe('connect ECONNREFUSED db:5432');
  });
});

describe('[NFR-006] ltiErrorLogFields', () => {
  it('[NFR-006][DATA-009] names the matched pattern with its mount path, else the unmatched label', () => {
    expect(ltiRouteLabel({ route: { path: '/play/:id' }, baseUrl: '/LTI' })).toBe('/lti/play/:id');
    expect(ltiRouteLabel({ route: undefined, baseUrl: '/static/lti' })).toBe('/static/lti/*');
    expect(ltiRouteLabel({ route: undefined, baseUrl: '' })).toBe('*');
  });

  it('[NFR-006][DATA-009] a client error keeps neither its message nor its properties, and a request ID is optional', () => {
    // Arrange: serve-static's 404 carries the asked-for file in `path` and in its message
    const notFound = Object.assign(new Error(`ENOENT: stat '/srv/${MARKER}'`), {
      status: 404,
      path: `/srv/${MARKER}`,
    });
    const req = { route: undefined, baseUrl: '' };
    // Act
    const withId = ltiErrorLogFields(notFound, 'client', req, { locals: { requestId: 'abc' } }, 404);
    const withoutId = ltiErrorLogFields(notFound, 'client', req, { locals: {} }, 404);
    // Assert
    expect(withId).toEqual({ route: '*', status: 404, requestId: 'abc' });
    expect(withoutId).toEqual({ route: '*', status: 404 });
  });
});
