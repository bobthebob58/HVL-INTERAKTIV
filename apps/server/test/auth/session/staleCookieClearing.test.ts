/**
 * Unit tests of where the order to delete a dead session cookie may travel (D-142): only on an answer that no
 * cache keeps, whatever way a route writes its headers.
 *
 * Spec: AUTH-003
 */
import express, { type Express, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { newOpaqueId } from '../../../src/auth/session/opaqueIds.js';
import { expiredSessionCookie, sessionCookie, setCookie } from '../../../src/auth/session/sessionCookies.js';
import { clearSessionCookieOnUncachedAnswer } from '../../../src/auth/session/staleCookieClearing.js';

const YEAR = 'public, max-age=31536000, immutable';

/** An app whose every answer was asked to clear a dead cookie, with one route per way of answering. */
function appWith(routes: Record<string, (res: Response) => void>): Express {
  const app = express();
  app.use((_req, res, next) => {
    clearSessionCookieOnUncachedAnswer(res);
    next();
  });
  for (const [path, answer] of Object.entries(routes)) app.get(path, (_req, res) => answer(res));
  return app;
}

const answered = async (answer: (res: Response) => void) => {
  const res = await request(appWith({ '/': answer })).get('/');
  return { cookie: res.headers['set-cookie'], cache: res.headers['cache-control'], status: res.status };
};

describe('[AUTH-003] the order to delete a dead session cookie', () => {
  it('[AUTH-003] never travels on an answer a cache may keep, however the route names its caching', async () => {
    // Act
    const kept = [
      await answered((res) => res.set('Cache-Control', YEAR).send('file')),
      await answered((res) => res.set('Cache-Control', 'public, max-age=60').type('js').send('x')),
      await answered((res) => res.set('Cache-Control', 'no-cache').send('revalidated')),
      await answered((res) => res.set('Cache-Control', 'max-age=0').send('stale at once')),
      await answered((res) => res.writeHead(200, { 'cache-control': YEAR }).end('object')),
      await answered((res) => res.writeHead(200, 'OK', ['Cache-Control', YEAR]).end('flat list')),
      await answered((res) => res.set('Cache-Control', YEAR).status(304).end()),
    ];
    // Assert
    expect(kept.map((answer) => answer.cookie)).toEqual(kept.map(() => undefined));
    expect(kept.map((answer) => answer.cache)).toEqual([
      YEAR,
      'public, max-age=60',
      'no-cache',
      'max-age=0',
      YEAR,
      YEAR,
      YEAR,
    ]);
  });

  it('[AUTH-003] travels on an answer marked no-store or private, also when writeHead names it', async () => {
    // Act
    const uncached = [
      await answered((res) => res.set('Cache-Control', 'no-store').json({})),
      await answered((res) => res.set('Cache-Control', 'private, max-age=60').send('one person')),
      await answered((res) => res.set('Cache-Control', 'No-Store, must-revalidate').redirect(303, '/')),
      await answered((res) => res.writeHead(200, { 'Cache-Control': 'no-store' }).end('object')),
      await answered((res) =>
        res.set('Cache-Control', YEAR).writeHead(200, ['cache-control', 'no-store']).end(),
      ),
    ];
    // Assert
    expect(uncached.map((answer) => answer.cookie)).toEqual(uncached.map(() => [expiredSessionCookie()]));
  });

  it('[AUTH-003] marks an answer that names no caching no-store, and clears the cookie on it', async () => {
    // Act
    const json = await answered((res) => res.json({}));
    const ended = await answered((res) => res.status(404).end());
    const piped = await answered((res) => {
      res.write('part');
      res.end();
    });
    // Assert
    for (const answer of [json, ended, piped]) {
      expect(answer.cookie).toEqual([expiredSessionCookie()]);
      expect(answer.cache).toBe('no-store');
    }
  });

  it('[AUTH-003] leaves an answer that sets the session cookie itself (a login) as it is', async () => {
    // Arrange
    const fresh = sessionCookie(newOpaqueId());
    // Act
    const login = await answered((res) => {
      setCookie(res, fresh);
      res.set('Cache-Control', 'no-store').redirect(303, '/');
    });
    // Assert
    expect(login.cookie).toEqual([fresh]);
  });

  it('[AUTH-003] keeps another cookie of the answer and adds the order beside it', async () => {
    // Act
    const res = await answered((res) =>
      res.set('Set-Cookie', 'other=1; Path=/').set('Cache-Control', 'no-store').end(),
    );
    // Assert
    expect(res.cookie).toEqual(['other=1; Path=/', expiredSessionCookie()]);
  });
});
