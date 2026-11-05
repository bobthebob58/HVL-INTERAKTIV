/**
 * Tests for the request log: one structured line per request with the route pattern, never the path, query, headers
 * or cookies, and a request ID that a client cannot fill with text of its choice (D-109's amendment of 2026-11-04).
 *
 * Spec: NFR-006, DATA-009
 */
import { readdirSync, readFileSync } from 'node:fs';
import express, { Router, type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { REQUEST_ID_HEADER, requestLog, routePattern } from '../../src/http/requestLog.js';
import { capturedLogger } from '../support/capturedLogger.js';

const CONTENT_ID = '01a1a8bf-c142-73a6-9172-d4918e8a4c1a';
const LTIK = 'eyJhbGciOiJIUzI1NiJ9.eyJwbGF0Zm9ybSI6Imh0dHBzOi8vY2FudmFzIn0.c2lnbmF0dXJlLXNpZ25hdHVyZQ';
const LEARNER_KEY = 'Qm9iLXRoZS1sZWFybmVyLWtleS1mb3ItdGVzdHMtb25seQ';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** An app mounted as createApp mounts its routers, with the request log first. */
const appWithLog = (now?: () => number) => {
  const { logger, lines } = capturedLogger();
  const api = Router()
    .get('/', (_req, res) => void res.send('api'))
    .get('/content/:contentId', (_req, res) => void res.json({}))
    .get('/fail/:id', () => {
      throw new Error('boom');
    })
    .get('/slow', (_req, res) => void setTimeout(() => res.end(), 300));
  const h5p = Router().use('/core', (_req, res) => void res.send('file'));
  const app = express()
    .use(requestLog(logger, now ? { now } : {}))
    .use('/api', api)
    .use('/h5p', h5p)
    .use((_req, res) => void res.status(404).send('nope'))
    .use(((_error, _req, res, _next) => void res.status(500).send('error')) satisfies ErrorRequestHandler);
  const logged = async (count = 1): Promise<Record<string, unknown>[]> => {
    await vi.waitFor(() => expect(lines).toHaveLength(count));
    return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  };
  return { app, lines, logged };
};

describe('[NFR-006] the request log', () => {
  it('[NFR-006] writes one line with request ID, method, route pattern, status and time, and returns the ID', async () => {
    // Arrange
    const clock = [100, 102.36];
    const { app, logged } = appWithLog(() => clock.shift() ?? 0);
    // Act
    const res = await request(app).get(`/api/content/${CONTENT_ID}`);
    // Assert
    const [line] = await logged();
    expect(line).toMatchObject({
      level: 'info',
      msg: 'request',
      method: 'GET',
      status: 200,
      durationMs: 2.4,
    });
    expect(line?.route).toBe('/api/content/:contentId');
    expect(line?.requestId).toBe(res.headers['x-request-id']);
    expect(Object.keys(line ?? {}).sort()).toEqual(
      ['durationMs', 'level', 'method', 'msg', 'requestId', 'route', 'service', 'status', 'time'].sort(),
    );
  });

  it('[DATA-009] never writes the path, query, headers, cookies or client address', async () => {
    // Arrange
    const { app, lines, logged } = appWithLog();
    // Act
    await request(app)
      .get(`/api/content/${CONTENT_ID}?ltik=${LTIK}&learnerKey=${LEARNER_KEY}`)
      .set('Authorization', `Bearer ${LTIK}`)
      .set('Cookie', '__Host-hvli_sid=session-secret-value')
      .set('X-Forwarded-For', '158.37.218.1');
    // Assert
    expect((await logged())[0]?.route).toBe('/api/content/:contentId');
    for (const value of [CONTENT_ID, LTIK, LEARNER_KEY, 'session-secret-value', '158.37.218.1', 'ltik']) {
      expect(lines.join('')).not.toContain(value);
    }
  });

  it.each([
    [
      'an upper-case UUID, lower-cased',
      'A3BB189E-8BF9-3888-9912-ACE4E6543002',
      'a3bb189e-8bf9-3888-9912-ace4e6543002',
    ],
    ['nginx’s 32 hexadecimal digits', '0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef'],
  ])('[NFR-006] keeps a well-formed inbound X-Request-Id: %s', async (_case, inbound, kept) => {
    const { app, logged } = appWithLog();
    const res = await request(app).get('/api').set(REQUEST_ID_HEADER, inbound);
    expect([res.headers['x-request-id'], (await logged())[0]?.requestId]).toEqual([kept, kept]);
  });

  it.each([
    ['an e-mail address', 'kari.nordmann@hvl.no'],
    ['a name', 'kari-nordmann'],
    ['an ltik', LTIK],
    ['33 hexadecimal digits', '0123456789abcdef0123456789abcdef0'],
  ])('[DATA-009] replaces an inbound X-Request-Id that is %s with a random UUID', async (_case, inbound) => {
    // Act
    const { app, lines, logged } = appWithLog();
    const res = await request(app).get('/api').set(REQUEST_ID_HEADER, inbound);
    // Assert
    const [line] = await logged();
    expect(line?.requestId).toMatch(UUID);
    expect(res.headers['x-request-id']).toBe(line?.requestId);
    expect(lines.join('')).not.toContain(inbound);
  });

  it.each([
    ['a router’s root route, as its mount path', '/api', 200, '/api'],
    [
      'a mount path in another case, lower-cased',
      `/API/content/${CONTENT_ID}`,
      200,
      '/api/content/:contentId',
    ],
    ['a response no route served, as its mount path', `/h5p/core/${CONTENT_ID}/h5p.js`, 200, '/h5p/core/*'],
    ['a path nothing serves, as *', `/aktivitet/${CONTENT_ID}`, 404, '*'],
    ['an error thrown in a route, as that route', `/api/fail/${CONTENT_ID}`, 500, '/api/fail/:id'],
  ])('[NFR-006] names %s', async (_case, path, status, route) => {
    const { app, logged } = appWithLog();
    await request(app).get(path);
    expect((await logged())[0]).toMatchObject({ status, route });
  });

  it('[NFR-006] logs a request the client gave up on once, marked aborted', async () => {
    // Arrange
    const { app, lines, logged } = appWithLog();
    // Act
    await expect(request(app).get('/api/slow').timeout(50)).rejects.toThrow();
    // Assert
    expect((await logged())[0]).toMatchObject({ route: '/api/slow', aborted: true });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(lines).toHaveLength(1);
  });

  it('[NFR-006] joins mount paths and route patterns, also for lists and regular expressions', () => {
    expect(routePattern('', '/')).toBe('/');
    expect(routePattern('/H5P', '/play/:contentId')).toBe('/h5p/play/:contentId');
    expect(routePattern('/api', ['/a', '/b/:id'])).toBe('/api/a|/api/b/:id');
    expect(routePattern('', /^\/x\/\d+$/)).toBe(String(/^\/x\/\d+$/));
  });
});

describe('[NFR-006] router mount paths hold no IDs', () => {
  const MOUNT_WITH_PARAMETERS = /\.use\(\s*(?:(['"`])[^'"`]*[:*{(][^'"`]*\1|\[|\/(?![/*]))/;
  const SRC = new URL('../../src/', import.meta.url);

  it('[NFR-006] the scan recognises a mount with parameters, a pattern, a list and a regular expression', () => {
    const mounts = [
      "router.use('/content/:contentId', sub)",
      'app.use(`/x/${id}`, sub)',
      "router.use('/{*rest}', s)",
    ];
    const others = ["app.use('/api', authenticate)", 'router.use(sub)', "router.use('/core', assetsOnly)"];
    expect(
      [...mounts, 'app.use(/^\\/x/, s)', "app.use(['/a'], s)"].every((t) => MOUNT_WITH_PARAMETERS.test(t)),
    ).toBe(true);
    expect(others.some((text) => MOUNT_WITH_PARAMETERS.test(text))).toBe(false);
  });

  it('[NFR-006] no server router is mounted on a path with parameters, so a logged mount path is never an ID', () => {
    // Act
    const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(
      (file) => /\.tsx?$/.test(file) && !file.startsWith('generated/'),
    );
    const offending = files.filter((file) =>
      MOUNT_WITH_PARAMETERS.test(readFileSync(new URL(file, SRC), 'utf8')),
    );
    // Assert
    expect(files.length).toBeGreaterThan(100);
    expect(offending).toEqual([]);
  });
});
