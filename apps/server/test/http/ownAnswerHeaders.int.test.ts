/**
 * Integration tests through the whole app that answers about the signed-in person carry `no-store`,
 * `Cross-Origin-Resource-Policy: same-origin` and a framing rule (D-131), on `/api`, `/auth/session` and the H5P
 * routes behind authentication, refused or not; that H5P's static files keep their own cache rule; and that a
 * Canvas page never sends the opener policy a portal page sends.
 *
 * Spec: AUTH-003, H5P-007, LTI-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
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
