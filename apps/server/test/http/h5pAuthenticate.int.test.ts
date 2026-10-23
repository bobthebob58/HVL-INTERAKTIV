/**
 * Integration tests for authentication on the H5P routes through the whole app: the ltik for Canvas requests, the
 * session and CSRF token for portal requests, the URLs the player hands to H5P, and what happens without either.
 *
 * Spec: H5P-007, AUTH-003, LTI-003, PROD-004
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../../src/auth/session/sessionCookies.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { loginWithFeide } from '../support/feideTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';
import { integrationText } from '../support/playerIntegration.js';

describeWithServices('Authentication on the H5P routes', () => {
  let tb: AppTestbed;
  let published: string;
  let ltik: string;
  let cookie: string;
  let csrf: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    published = await tb.activity(await tb.staffAccount(), { published: true });
    ltik = (await launchFromCanvas(tb.app, tb.mock.canvas, { custom: { contentId: published } })).ltik ?? '';
    const login = await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author');
    cookie = login.sessionCookie ?? '';
    csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
  }, 60_000);
  afterAll(() => tb.close());

  const state = () => `/h5p/contentUserData/${published}/state/0`;

  describe('in Canvas', () => {
    it('[H5P-007] learner state needs the ltik: without it 401, with it 200', async () => {
      const without = await request(tb.app).get(state());
      const withLtik = await request(tb.app).get(`${state()}?ltik=${encodeURIComponent(ltik)}`);
      expect(without.status).toBe(401);
      expect(withLtik.status).toBe(200);
    });

    it('[H5P-007] the player gives H5P URLs that carry the ltik, URL-encoded, and signed file URLs', async () => {
      // Act
      const page = await request(tb.app).get(`/lti/play?ltik=${encodeURIComponent(ltik)}`);
      // Assert
      const integration = integrationText(page.text);
      expect(integration).toContain(`ltik=${encodeURIComponent(ltik)}`);
      expect(integration).toMatch(/\/h5p\/files\/[^/"]+\//);
      expect(integration).not.toContain('csrf=');
    });

    it('[LTI-003] the ltik in the query of another H5P route is refused', async () => {
      const res = await request(tb.app).get(`/h5p/play/${published}?ltik=${encodeURIComponent(ltik)}`);
      expect(res.status).toBe(401);
    });
  });

  describe('in the portal', () => {
    it('[H5P-007] learner state needs the CSRF token with the session cookie', async () => {
      const without = await request(tb.app).get(state()).set('Cookie', cookie);
      const withToken = await request(tb.app).get(`${state()}?csrf=${csrf}`).set('Cookie', cookie);
      expect(without.status).toBe(401);
      expect(without.body.errorCode).toBe('hvl:csrf-invalid');
      expect(withToken.status).toBe(200);
    });

    it('[H5P-007] the portal player gives H5P URLs that carry the CSRF token, never an ltik', async () => {
      const page = await request(tb.app).get(`/h5p/play/${published}`).set('Cookie', cookie);
      expect(page.status).toBe(200);
      expect(page.text).toContain(`csrf=${encodeURIComponent(csrf)}`);
      expect(page.text).not.toContain('ltik=');
    });

    it('[PROD-004] the player without a session goes to Feide login and comes back', async () => {
      const res = await request(tb.app).get(`/h5p/play/${published}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `/auth/feide/login?returnTo=${encodeURIComponent(`/h5p/play/${published}`)}`,
      );
    });

    it('[AUTH-003] an expired session gets 401 `session-expired` on an API call and clears the cookie', async () => {
      const res = await request(tb.app).get(state()).set('Cookie', `${SESSION_COOKIE}=gone-session-id`);
      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('hvl:session-expired');
      expect(String(res.headers['set-cookie'])).toContain(`${SESSION_COOKIE}=;`);
    });

    it('[AUTH-003] after logout the old cookie no longer works', async () => {
      // Arrange: a second session, so the shared one stays usable
      const other = await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author');
      const otherCookie = other.sessionCookie ?? '';
      const token = (await request(tb.app).get('/auth/session').set('Cookie', otherCookie)).body
        .csrfToken as string;
      // Act
      const logout = await request(tb.app)
        .post('/auth/logout')
        .set('Cookie', otherCookie)
        .type('form')
        .send({ csrf: token });
      const after = await request(tb.app).get(`${state()}?csrf=${token}`).set('Cookie', otherCookie);
      // Assert
      expect(logout.status).toBe(303);
      expect(after.status).toBe(401);
    });
  });
});
