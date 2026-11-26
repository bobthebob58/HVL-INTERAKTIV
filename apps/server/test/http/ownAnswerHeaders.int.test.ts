/**
 * Integration tests through the whole app that answers about the signed-in person carry `no-store`,
 * `Cross-Origin-Resource-Policy: same-origin` and a framing rule (D-131), on `/api`, `/auth/session` and the H5P
 * routes behind authentication, refused or not; that H5P's static files keep their own cache rule and never
 * carry the order to delete a dead session cookie (D-142); and that a Canvas page never sends the opener policy a
 * portal page sends.
 *
 * Spec: AUTH-003, H5P-007, LTI-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { newOpaqueId } from '../../src/auth/session/opaqueIds.js';
import { SESSION_COOKIE, expiredSessionCookie } from '../../src/auth/session/sessionCookies.js';
import { SERVED_THEME_FILES, THEME_PATH } from '../../src/h5p/h5pAssets.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { describeWithServices } from '../support/services.js';

const OWN = {
  'cache-control': 'no-store',
  'cross-origin-resource-policy': 'same-origin',
  'x-frame-options': 'SAMEORIGIN',
};

describeWithServices('[AUTH-003] the headers of answers about the signed-in person', () => {
  let tb: AppTestbed;
  beforeAll(async () => {
    tb = await openAppTestbed();
  }, 60_000);
  afterAll(() => tb.close());

  it.each([
    '/api/me',
    '/api/content',
    '/auth/session',
    '/h5p/ajax?action=content-type-cache',
    '/h5p/contentUserData/0192f1a2-3b4c-7d5e-8f60-000000000001/state/0',
    '/h5p/params/0192f1a2-3b4c-7d5e-8f60-000000000001',
    '/h5p/download/0192f1a2-3b4c-7d5e-8f60-000000000001',
    '/h5p/no-such-route',
  ])(
    '[AUTH-003] %s is no-store, same-origin only and framed by nothing else, also when it refuses',
    async (path) => {
      // Act
      const res = await request(tb.app).get(path);
      // Assert
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.headers).toMatchObject(OWN);
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'self'");
    },
  );

  it('[H5P-007] H5P’s own static files keep their cache rule and are not marked same-origin only', async () => {
    // Act
    const res = await request(tb.app).get('/h5p/boot/editorPage.js');
    // Assert
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['cross-origin-resource-policy']).toBeUndefined();
  });

  it('[AUTH-003] a dead session cookie is cleared by an answer about the person, never by a shared file', async () => {
    // Arrange: a browser whose session has run out, and two files that are the same for everyone
    const dead = `${SESSION_COOKIE}=${newOpaqueId()}`;
    const [theme] = SERVED_THEME_FILES;
    // Act
    const longCached = await request(tb.app)
      .get(`/h5p${THEME_PATH}/${theme?.name}?version=${theme?.version}`)
      .set('Cookie', dead);
    const revalidated = await request(tb.app).get('/h5p/boot/editorPage.js').set('Cookie', dead);
    const own = await request(tb.app).get('/auth/session').set('Cookie', dead);
    // Assert
    expect([longCached.status, revalidated.status, own.status]).toEqual([200, 200, 401]);
    expect(longCached.headers['cache-control']).toContain('public');
    expect([longCached.headers['set-cookie'], revalidated.headers['set-cookie']]).toEqual([
      undefined,
      undefined,
    ]);
    expect(own.headers['set-cookie']).toEqual([expiredSessionCookie()]);
    expect(own.headers['cache-control']).toBe('no-store');
  });

  it('[LTI-003] a Canvas page sends no opener policy; the portal’s message page does', async () => {
    // Act
    const canvasPage = await request(tb.app).get('/lti/play');
    const portalPage = await request(tb.app).get('/auth/logged-out');
    // Assert
    expect(canvasPage.status).toBe(401);
    expect(canvasPage.headers['cross-origin-opener-policy']).toBeUndefined();
    expect(portalPage.headers['cross-origin-opener-policy']).toBe('same-origin');
  });
});
