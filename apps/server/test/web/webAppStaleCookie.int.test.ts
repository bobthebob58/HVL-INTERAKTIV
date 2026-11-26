/**
 * Integration test of the order to delete a dead session cookie on what the built web app (apps/web) answers:
 * Next.js writes its own headers, so the rule of D-142 is checked on its real answers. A page is about the person
 * and carries the order; a file under `/_next/static/` is the same for everyone, is kept by caches for a year and
 * never carries it.
 *
 * Spec: AUTH-003
 */
import express from 'express';
import { describe, expect, it } from 'vitest';
import { newOpaqueId } from '../../src/auth/session/opaqueIds.js';
import { SESSION_COOKIE, expiredSessionCookie } from '../../src/auth/session/sessionCookies.js';
import { clearSessionCookieOnUncachedAnswer } from '../../src/auth/session/staleCookieClearing.js';
import { baseSecurityHeaders } from '../../src/http/securityHeaders.js';
import { webRoutes } from '../../src/web/webRoutes.js';
import { serveBuiltWebApp, WEB_APP_BUILT } from './webTestServer.js';

if (!WEB_APP_BUILT) console.warn('Web app tests skipped: apps/web is not built (npm run build).');

(WEB_APP_BUILT ? describe : describe.skip)('[AUTH-003] a dead session cookie and the built web app', () => {
  const base = serveBuiltWebApp((web) =>
    express()
      .use(baseSecurityHeaders({ https: false }))
      // WHY: what ../../src/auth/session/portalSessionMiddleware.ts does for a cookie that names no live session.
      .use((req, res, next) => {
        if (req.headers.cookie !== undefined) clearSessionCookieOnUncachedAnswer(res);
        next();
      })
      .use(webRoutes(web)),
  );
  const ask = (path: string, cookie?: string) =>
    fetch(`${base()}${path}`, { headers: cookie === undefined ? {} : { cookie } });

  it('[AUTH-003] a page carries the order; a file kept by caches for a year never does', async () => {
    // Arrange: a browser whose session has run out, and a script of the page it opens
    const dead = `${SESSION_COOKIE}=${newOpaqueId()}`;
    const page = await ask('/hjelp', dead);
    const script = /"(\/_next\/static\/[^"]+\.js)"/.exec(await page.text())?.[1] ?? '';
    // Act
    const file = await ask(script, dead);
    const unconditional = await ask(script);
    // Assert
    expect([page.status, file.status]).toEqual([200, 200]);
    expect(page.headers.getSetCookie()).toEqual([expiredSessionCookie()]);
    expect(page.headers.get('cache-control')).toMatch(/no-store|private/);
    expect(script).toMatch(/^\/_next\/static\//);
    expect(file.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(file.headers.getSetCookie()).toEqual([]);
    expect(file.headers.get('cache-control')).toBe(unconditional.headers.get('cache-control'));
  });
});
