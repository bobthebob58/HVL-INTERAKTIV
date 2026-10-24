/**
 * Tests for the hand-over to the web app: only GET and HEAD reach it, with the launch's, the link's or the session's
 * locale, the same nonce in
 * the request and the response, and no credentials; the development server's WebSocket upgrades get no credentials
 * either. The web app is a stub that records what it received.
 *
 * Spec: DATA-011, LTI-003, PROD-012, DATA-006, UD-010
 */
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { LAUNCH_HEADER, setAppLaunch, type AppLaunch } from '../../src/web/appLaunch.js';
import { webRoutes, webUpgrades, type WebRouteOptions } from '../../src/web/webRoutes.js';

/** An app with a fake portal session (or none), a resolved launch (or none) and a recording web app. */
function appWith(locale?: 'nn' | 'nb' | 'en', launch?: AppLaunch, options?: WebRouteOptions) {
  const seen: IncomingMessage[] = [];
  const app = express();
  app.use((_req, res, next) => {
    if (locale) res.locals.hvliPortalSession = { sid: 'sid', session: { locale } };
    if (launch) setAppLaunch(res, launch);
    next();
  });
  app.use(
    webRoutes(
      {
        dev: false,
        handle: async (req, res) => {
          seen.push(req);
          res.end('web');
        },
      },
      options,
    ),
  );
  app.use((_req, res) => void res.status(404).send('express 404'));
  return { app, seen };
}

describe('[DATA-011] hand-over to the web app', () => {
  it('[DATA-011] a GET page gets one nonce in both policies, and the session locale', async () => {
    // Arrange
    const { app, seen } = appWith('en');
    // Act
    const res = await request(app)
      .get('/hjelp?ltik=abc')
      .set('Cookie', 'a=b')
      .set('Authorization', 'Bearer x');
    // Assert
    expect(res.text).toBe('web');
    const sent = /'nonce-([^']+)'/.exec(res.headers['content-security-policy'] ?? '')?.[1];
    expect(sent).toBeDefined();
    expect(seen[0]?.headers['content-security-policy']).toBe(res.headers['content-security-policy']);
    expect(seen[0]?.headers['x-hvli-locale']).toBe('en');
    expect(seen[0]?.headers.cookie).toBeUndefined();
    expect(seen[0]?.headers.authorization).toBeUndefined();
    expect(seen[0]?.url).toBe('/hjelp');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('[PROD-012] without a session the locale is Nynorsk, whatever the client sends', async () => {
    const { app, seen } = appWith();
    await request(app).get('/hjelp').set('x-hvli-locale', 'en');
    expect(seen[0]?.headers['x-hvli-locale']).toBe('nn');
  });

  it.each([
    ['en', undefined, 'en'],
    ['nb', 'nn', 'nb'],
    ['de', 'en', 'en'],
    ['EN', undefined, 'nn'],
  ] as const)(
    '[DATA-006] a link with lang=%s and a %s session shows the page in %s',
    async (lang, session, expected) => {
      const { app, seen } = appWith(session);
      await request(app).get(`/personvern?lang=${lang}`);
      expect(seen[0]?.headers['x-hvli-locale']).toBe(expected);
    },
  );

  it('[DATA-006] a repeated lang is ignored, and a launch’s locale wins over the link’s', async () => {
    // Arrange
    const { app, seen } = appWith();
    const launched = appWith(undefined, { contentId: 'c1', title: 'T', mayEdit: false, locale: 'nb' });
    // Act
    await request(app).get('/hjelp?lang=en&lang=nb');
    await request(launched.app).get('/app/play?lang=en');
    // Assert
    expect(seen[0]?.headers['x-hvli-locale']).toBe('nn');
    expect(launched.seen[0]?.headers['x-hvli-locale']).toBe('nb');
  });

  it('[LTI-003] other methods never reach the web app', async () => {
    const { app, seen } = appWith('nn');
    for (const method of ['post', 'put', 'delete', 'patch'] as const) {
      expect((await request(app)[method]('/hjelp')).text).toBe('express 404');
    }
    expect((await request(app).head('/hjelp')).status).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it('[DATA-011] each response gets its own nonce', async () => {
    const { app } = appWith();
    const nonces = await Promise.all(
      [1, 2, 3].map(async () => (await request(app).get('/')).headers['content-security-policy']),
    );
    expect(new Set(nonces).size).toBe(3);
  });

  it('[LTI-006] a launch page gets the launch facts with the activity language, its locale and Canvas framing; no client can forge them', async () => {
    // Arrange
    const { app, seen } = appWith(
      undefined,
      { contentId: 'c1', title: 'Brøkar ✓', mayEdit: true, locale: 'en', language: 'nn' },
      { canvasOrigins: ['https://hvl.instructure.com'] },
    );
    // Act
    const res = await request(app).get('/app/play').set('x-hvli-launch', 'forged');
    // Assert
    const header = String(seen[0]?.headers[LAUNCH_HEADER]);
    expect(JSON.parse(decodeURIComponent(header))).toEqual({
      contentId: 'c1',
      title: 'Brøkar ✓',
      mayEdit: true,
      locale: 'en',
      language: 'nn',
    });
    expect(seen[0]?.headers['x-hvli-locale']).toBe('en');
    expect(res.headers['content-security-policy']).toMatch(
      /frame-ancestors 'self' https:\/\/hvl\.instructure\.com$/,
    );
    expect(res.headers['x-frame-options']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('[LTI-003] a page without a launch never carries a launch header, even a forged one', async () => {
    const { app, seen } = appWith();
    await request(app).get('/app/play').set('x-hvli-launch', encodeURIComponent('{"mayEdit":true}'));
    expect(seen[0]?.headers[LAUNCH_HEADER]).toBeUndefined();
  });
});

describe('[LTI-003] WebSocket upgrades of the development server', () => {
  /** An upgrade request as Node parses it, with the session cookie the browser sends along. */
  const upgradeRequest = (url: string): IncomingMessage => {
    const req = new IncomingMessage(new Socket());
    req.url = url;
    req.rawHeaders = ['Cookie', '__Host-hvli_sid=secret', 'Upgrade', 'websocket'];
    req.headers = { cookie: '__Host-hvli_sid=secret', upgrade: 'websocket' };
    return req;
  };

  it('[LTI-003] a /_next/ upgrade reaches Next.js without the cookie; any other upgrade is closed', async () => {
    // Arrange
    const seen: IncomingMessage[] = [];
    const listener = webUpgrades({ upgrade: async (req) => void seen.push(req) });
    const other = new Socket();
    // Act
    listener(upgradeRequest('/_next/webpack-hmr?ltik=abc'), new Socket(), Buffer.alloc(0));
    listener(upgradeRequest('/lti/play'), other, Buffer.alloc(0));
    await Promise.resolve();
    // Assert
    expect(seen).toHaveLength(1);
    expect(seen[0]?.headers).toEqual({ upgrade: 'websocket' });
    expect(seen[0]?.rawHeaders.join(' ')).not.toContain('secret');
    expect(seen[0]?.url).toBe('/_next/webpack-hmr');
    expect(other.destroyed).toBe(true);
  });
});
