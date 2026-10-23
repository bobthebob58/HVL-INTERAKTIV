/**
 * Integration tests for logout through Feide, the CSRF check on it, the session endpoint and session replacement
 * at login.
 *
 * Spec: AUTH-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../../../src/auth/session/sessionCookies.js';
import { sessionRedisKey } from '../../../src/auth/session/SessionStore.js';
import { describeWithServices } from '../../support/services.js';
import { loginWithFeide, openFeideTestbed, TOOL_URL, type FeideTestbed } from '../../support/feideTestbed.js';

describeWithServices('[AUTH-003] logout and the portal session', () => {
  let tb: FeideTestbed;
  beforeAll(async () => {
    tb = await openFeideTestbed();
  }, 60_000);
  afterAll(() => tb.close());

  const sidOf = (cookie: string | undefined) => cookie?.split('=')[1] ?? '';
  const csrfOf = async (cookie: string) =>
    String((await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken);

  it('[AUTH-003] gives page scripts the CSRF token, roles and language of the session, never cached', async () => {
    // Arrange
    const { sessionCookie = '' } = await loginWithFeide(tb, 'student');
    // Act
    const res = await request(tb.app).get('/auth/session').set('Cookie', sessionCookie);
    const anonymous = await request(tb.app).get('/auth/session');
    // Assert
    expect(res.body).toEqual({
      roles: ['learner'],
      locale: 'nn',
      hvlMember: true,
      studentAuthor: false,
      csrfToken: expect.stringMatching(/^[\w-]{43}$/),
    });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(anonymous.status).toBe(401);
  });

  it('[AUTH-003] logs out through Feide with id_token_hint and the logout redirect, and the token is gone', async () => {
    // Arrange
    const { sessionCookie = '' } = await loginWithFeide(tb, 'author');
    const sid = sidOf(sessionCookie);
    // Act
    const res = await request(tb.app)
      .post('/auth/logout')
      .set('Cookie', sessionCookie)
      .type('form')
      .send({ csrf: await csrfOf(sessionCookie) });
    // Assert
    expect(res.status).toBe(303);
    const target = new URL(String(res.headers.location));
    expect(`${target.origin}${target.pathname}`).toBe(tb.feide.endSessionUrl);
    expect(target.searchParams.get('post_logout_redirect_uri')).toBe(`${TOOL_URL}/auth/logged-out`);
    expect(target.searchParams.get('id_token_hint')?.split('.')).toHaveLength(3);
    expect(await tb.redis.exists(sessionRedisKey(sid))).toBe(0);
    expect(res.headers['set-cookie']?.[0]).toMatch(new RegExp(`^${SESSION_COOKIE}=; Max-Age=0`));
  });

  it("[AUTH-003] refuses a logout without the session's CSRF token, and the session stays", async () => {
    // Arrange
    const { sessionCookie = '' } = await loginWithFeide(tb, 'author');
    // Act
    const missing = await request(tb.app).post('/auth/logout').set('Cookie', sessionCookie);
    const wrong = await request(tb.app)
      .post('/auth/logout')
      .set('Cookie', sessionCookie)
      .type('form')
      .send({ csrf: 'x'.repeat(43) });
    // Assert
    for (const res of [missing, wrong]) {
      expect(res.status).toBe(401);
      expect(res.text).toContain('Økta di kunne ikkje stadfestast');
    }
    expect(await tb.sessions.get(sidOf(sessionCookie))).toBeDefined();
  });

  it('[AUTH-003] replaces the session at login, so an earlier session ID no longer works', async () => {
    // Arrange
    const first = await loginWithFeide(tb, 'author');
    // Act: the same browser logs in again, sending its old session cookie.
    tb.feide.nextLogin('author');
    const start = await request(tb.app)
      .get('/auth/feide/login')
      .set('Cookie', first.sessionCookie ?? '');
    const authorize = await fetch(String(start.headers.location), { redirect: 'manual' });
    const callback = new URL(authorize.headers.get('location') ?? '');
    const loginCookie = (start.headers['set-cookie'] as unknown as string[])[0]?.split(';')[0] ?? '';
    const second = await request(tb.app)
      .get(`${callback.pathname}${callback.search}`)
      .set('Cookie', `${first.sessionCookie ?? ''}; ${loginCookie}`);
    // Assert
    expect(second.status).toBe(303);
    expect(await tb.sessions.get(sidOf(first.sessionCookie))).toBeUndefined();
  });

  it('[AUTH-003] says goodbye on the logged-out page with a way back in', async () => {
    const res = await request(tb.app).get('/auth/logged-out');
    expect(res.text).toContain('<h1>Du er logga ut</h1>');
    expect(res.text).toContain('href="/auth/feide/login"');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});
