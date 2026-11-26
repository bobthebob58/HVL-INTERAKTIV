/**
 * Integration tests against the mock Feide of who may start a login and which callback uses a pending login up
 * (D-131): a page the person opened starts one, a page another site opened without a click gets the sign-in page,
 * a background request is refused; and a callback that is not the pending login's, or no page, leaves that login
 * usable for Feide's own answer.
 *
 * Spec: AUTH-001, AUTH-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { LOGIN_COOKIE, SESSION_COOKIE } from '../../../src/auth/session/sessionCookies.js';
import { cookiePair, openFeideTestbed, type FeideTestbed } from '../../support/feideTestbed.js';
import { describeWithServices } from '../../support/services.js';

const PAGE = { 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };
const CLICK = { ...PAGE, 'Sec-Fetch-User': '?1' };

describeWithServices('[AUTH-003] starting and finishing a Feide login', () => {
  let tb: FeideTestbed;
  beforeAll(async () => {
    tb = await openFeideTestbed();
  }, 60_000);
  afterAll(() => tb.close());

  const start = (headers: Record<string, string>) =>
    request(tb.app).get('/auth/feide/login').query({ returnTo: '/aktivitet/x' }).set(headers);
  /** Starts a login as a browser without fetch metadata and follows Feide's redirect back, without calling back. */
  const pendingLogin = async () => {
    tb.feide.nextLogin('author');
    const begun = await request(tb.app).get('/auth/feide/login');
    const authorize = await fetch(String(begun.headers.location), { redirect: 'manual' });
    const callback = new URL(authorize.headers.get('location') ?? '');
    return { cookie: cookiePair(begun, LOGIN_COOKIE) ?? '', path: `${callback.pathname}${callback.search}` };
  };

  it.each([
    ['our own page', { ...PAGE, 'Sec-Fetch-Site': 'same-origin' }],
    ['a typed address', { ...PAGE, 'Sec-Fetch-Site': 'none' }],
    ['a link the person clicked on another site', { ...CLICK, 'Sec-Fetch-Site': 'cross-site' }],
  ])('[AUTH-001] %s starts the login', async (_case, headers) => {
    // Act
    const res = await start(headers);
    // Assert
    expect(res.status).toBe(302);
    expect(cookiePair(res, LOGIN_COOKIE)).toBeDefined();
  });

  it.each([
    ['another site, without a click', { ...PAGE, 'Sec-Fetch-Site': 'cross-site' }],
    ['a frame', { ...CLICK, 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Site': 'same-origin' }],
  ])('[AUTH-003] a page opened by %s gets the sign-in page and starts nothing', async (_case, headers) => {
    // Act
    const res = await start(headers);
    // Assert
    expect(res.status).toBe(200);
    expect(res.text).toContain(
      '<a href="/auth/feide/login?returnTo=%2Faktivitet%2Fx" target="_top">Logg inn med Feide</a>',
    );
    expect(res.headers.location).toBeUndefined();
    expect(cookiePair(res, LOGIN_COOKIE)).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['an image on another site', { 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'image' }],
    ['a background fetch', { 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' }],
  ])('[AUTH-003] %s is refused and starts nothing', async (_case, headers) => {
    // Act
    const res = await start({ ...headers, 'Sec-Fetch-Site': 'cross-site' });
    // Assert
    expect(res.status).toBe(400);
    expect(cookiePair(res, LOGIN_COOKIE)).toBeUndefined();
  });

  it('[AUTH-001] a callback that is not the pending login’s is refused and leaves the login for Feide’s answer', async () => {
    // Arrange
    const login = await pendingLogin();
    const call = (path: string) => request(tb.app).get(path).set('Cookie', login.cookie);
    // Act
    const madeUp = await call('/auth/feide/callback?code=x&state=not-this-login');
    const noState = await call('/auth/feide/callback?code=x');
    const real = await call(login.path);
    const again = await call(login.path);
    // Assert
    expect([madeUp.status, noState.status]).toEqual([400, 400]);
    expect(cookiePair(madeUp, LOGIN_COOKIE)).toBeUndefined();
    expect(String(madeUp.headers['set-cookie'] ?? '')).not.toContain(`${LOGIN_COOKIE}=;`);
    expect(real.status).toBe(303);
    expect(cookiePair(real, SESSION_COOKIE)).toBeDefined();
    expect(again.status).toBe(400);
  });

  it('[AUTH-001] the right callback sent as something other than a page is refused, and the login stays usable', async () => {
    // Arrange
    const login = await pendingLogin();
    // Act
    const asImage = await request(tb.app)
      .get(login.path)
      .set('Cookie', login.cookie)
      .set({ 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'image' });
    const asPage = await request(tb.app)
      .get(login.path)
      .set('Cookie', login.cookie)
      .set({ ...PAGE, 'Sec-Fetch-Site': 'cross-site' });
    // Assert
    expect(asImage.status).toBe(400);
    expect(cookiePair(asImage, SESSION_COOKIE)).toBeUndefined();
    expect(asPage.status).toBe(303);
  });
});
