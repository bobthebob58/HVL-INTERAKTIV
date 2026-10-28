/**
 * Integration tests for the studio routes through the whole app: a public route (`auth: 'none'`, D-089) answers a
 * signed-out request through the real authentication middleware, a signed-in route refuses it, a portal-only route
 * refuses a valid Canvas launch, and the middleware's own refusals (a bad ltik, a missing CSRF token) still apply.
 * Three test-only routes stand in for the studio's areas.
 *
 * Spec: DOC-012, AUTH-003, LTI-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { CSRF_HEADER } from '../../../src/auth/session/csrfToken.js';
import { SESSION_COOKIE } from '../../../src/auth/session/sessionCookies.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

// WHY: the areas have no routes yet; these show what any public, signed-in or portal-only studio route meets.
vi.mock('../../../src/learningDesign/http/studioContentRoutes.js', async () => {
  const { Router } = await import('express');
  const { principalOf, requirePrincipal } = await import('../../../src/auth/principalLocals.js');
  const { requirePortalAuthor } = await import('../../../src/learningDesign/http/studioPrincipal.js');
  return {
    studioContentRoutes: () =>
      Router()
        .get(
          '/studio-test/public',
          (_req, res) => void res.json({ signedIn: principalOf(res)?.mode ?? null }),
        )
        .post('/studio-test/signed-in', (_req, res) => void res.json({ mode: requirePrincipal(res).mode }))
        .get(
          '/studio-test/portal-only',
          (_req, res) => void res.json({ mode: requirePortalAuthor(res).mode }),
        ),
  };
});

const PUBLIC = '/api/studio-test/public';
const SIGNED_IN = '/api/studio-test/signed-in';
const PORTAL_ONLY = '/api/studio-test/portal-only';

describeWithServices('[DOC-012] studio routes through the app', () => {
  let tb: AppTestbed;
  let cookie: string;
  let csrf: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    cookie = (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author')).sessionCookie ?? '';
    csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
  }, 60_000);
  afterAll(() => tb.close());

  it('[DOC-012] a public route answers a signed-out request, with no principal and no-store', async () => {
    // Act
    const res = await request(tb.app).get(PUBLIC);
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ signedIn: null });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('[DOC-012] a public route answers a request with a dead session cookie, and clears the cookie', async () => {
    // Act
    const res = await request(tb.app).get(PUBLIC).set('Cookie', `${SESSION_COOKIE}=no-such-session`);
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ signedIn: null });
    expect(String(res.headers['set-cookie'])).toContain(`${SESSION_COOKIE}=;`);
  });

  it('[AUTH-003] a public route sees a signed-in author, who needs no CSRF token to read', async () => {
    const res = await request(tb.app).get(PUBLIC).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ signedIn: 'portal' });
  });

  it('[LTI-003] a public route still refuses a request with an ltik that is not valid', async () => {
    const res = await request(tb.app).get(PUBLIC).set('Authorization', 'Bearer not.an.ltik');
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('hvl:ltik-invalid');
  });

  it('[AUTH-003] a signed-in route refuses a signed-out request and a portal write without the CSRF token', async () => {
    // Act
    const signedOut = await request(tb.app).post(SIGNED_IN);
    const withoutToken = await request(tb.app).post(SIGNED_IN).set('Cookie', cookie);
    const withToken = await request(tb.app).post(SIGNED_IN).set('Cookie', cookie).set(CSRF_HEADER, csrf);
    // Assert
    expect([signedOut.status, signedOut.body.errorCode]).toEqual([401, 'hvl:unauthenticated']);
    expect([withoutToken.status, withoutToken.body.errorCode]).toEqual([401, 'hvl:csrf-invalid']);
    expect([withToken.status, withToken.body]).toEqual([200, { mode: 'portal' }]);
  });

  it('[LTI-003] a portal-only route refuses a valid Canvas instructor launch, and admits the portal author', async () => {
    // Arrange: a Deep Linking launch as the teacher gives a valid ltik for an LTI author
    const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: { sub: `teacher-${Date.now()}`, roles: CANVAS_USERS.teacher.roles },
    });
    const bearer = `Bearer ${ltik ?? ''}`;
    // Act
    const publicWithLtik = await request(tb.app).get(PUBLIC).set('Authorization', bearer);
    const portalOnlyWithLtik = await request(tb.app).get(PORTAL_ONLY).set('Authorization', bearer);
    const portalOnlyWithSession = await request(tb.app).get(PORTAL_ONLY).set('Cookie', cookie);
    // Assert
    expect([publicWithLtik.status, publicWithLtik.body]).toEqual([200, { signedIn: 'lti' }]);
    expect([portalOnlyWithLtik.status, portalOnlyWithLtik.body.errorCode]).toEqual([
      401,
      'hvl:unauthenticated',
    ]);
    expect([portalOnlyWithSession.status, portalOnlyWithSession.body]).toEqual([200, { mode: 'portal' }]);
  });

  it('[DOC-012] a path no studio area answers still gets the API’s 404', async () => {
    const res = await request(tb.app).get('/api/studio-test/nothing-here');
    expect([res.status, res.body.errorCode]).toEqual([404, 'error.notFound']);
  });
});
