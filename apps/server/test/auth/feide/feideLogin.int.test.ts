/**
 * Integration tests for Feide login against the mock Feide: the full flow, roles, data minimisation and every
 * refused callback.
 *
 * Spec: AUTH-001, AUTH-002, AUTH-004, DATA-002
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../../../src/auth/session/sessionCookies.js';
import { describeWithServices } from '../../support/services.js';
import {
  cookiePair,
  loginWithFeide,
  openFeideTestbed,
  type FeideTestbed,
} from '../../support/feideTestbed.js';

describeWithServices('[AUTH-001] Feide login', () => {
  let tb: FeideTestbed;
  beforeAll(async () => {
    tb = await openFeideTestbed();
  }, 60_000);
  afterAll(() => tb.close());

  const sessionOf = async (cookie: string | undefined) => tb.sessions.get(cookie?.split('=')[1] ?? '');

  it('[AUTH-001] logs an author in, sets the session cookie and returns to the local path asked for', async () => {
    // Arrange
    const started = new Date();
    // Act
    const { res, sessionCookie } = await loginWithFeide(tb, 'author', '/h5p/play/x?lang=nb');
    // Assert
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/h5p/play/x?lang=nb');
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith(`${SESSION_COOKIE}=`),
    );
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) {
      expect(setCookie?.split('; '), attribute).toContain(attribute);
    }
    expect(setCookie).not.toMatch(/Domain=|Max-Age=/);
    const session = await sessionOf(sessionCookie);
    expect(session).toMatchObject({
      roles: ['author', 'admin'],
      hvlMember: true,
      studentAuthor: false,
      locale: 'nn',
    });
    const user = await tb.db.user.findUniqueOrThrow({ where: { id: session?.userId ?? '' } });
    expect(user).toMatchObject({ kind: 'staff', displayName: 'Aud Forfattar', email: 'author@hvl.no' });
    expect(
      await tb.db.authAuditEvent.count({
        where: { actorUserId: user.id, event: 'login.feide', at: { gte: started } },
      }),
    ).toBe(1);
  });

  it('[AUTH-001] never redirects off-site after login', async () => {
    for (const returnTo of [
      '//evil.example',
      'https://evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
    ]) {
      expect((await loginWithFeide(tb, 'author', returnTo)).res.headers.location, returnTo).toBe('/');
    }
  });

  it("[AUTH-001] refuses a callback without this browser's login cookie, or used a second time", async () => {
    // Arrange: two logins in flight; the second browser's cookie is used for the first callback.
    const first = await loginWithFeide(tb, 'author');
    const other = await loginWithFeide(tb, 'student');
    // Act
    const replay = await request(tb.app).get(first.callbackPath).set('Cookie', first.loginCookie);
    const crossed = await request(tb.app).get(first.callbackPath).set('Cookie', other.loginCookie);
    const missing = await request(tb.app).get(first.callbackPath);
    // Assert
    for (const res of [replay, crossed, missing]) {
      expect(res.status).toBe(400);
      expect(res.text).toContain('Innlogginga mislukkast');
      expect(cookiePair(res, SESSION_COOKIE)).toBeUndefined();
    }
  });

  it.each([
    ['another audience', (p: Record<string, unknown>) => void (p.aud = 'someone-else')],
    ['another issuer', (p: Record<string, unknown>) => void (p.iss = 'http://evil.example')],
    ['an expired token', (p: Record<string, unknown>) => void (p.exp = Math.floor(Date.now() / 1000) - 120)],
    ['another nonce', (p: Record<string, unknown>) => void (p.nonce = 'not-ours')],
  ])('[AUTH-001] refuses an ID token with %s and audits it', async (_name, edit) => {
    // Arrange
    tb.feide.tamperNextIdToken((payload) => edit(payload));
    // Act
    const { res, sessionCookie } = await loginWithFeide(tb, 'author');
    // Assert
    expect(res.status).toBe(400);
    expect(sessionCookie).toBeUndefined();
    expect(
      await tb.db.authAuditEvent.findFirst({
        where: { event: 'login.feide.failed' },
        orderBy: { at: 'desc' },
      }),
    ).toMatchObject({ reason: 'token-invalid' });
  });

  it("[AUTH-001] refuses an ID token signed with a key outside Feide's JWKS", async () => {
    tb.feide.forgeNextIdTokenSignature();
    const { res, sessionCookie } = await loginWithFeide(tb, 'author');
    expect(res.status).toBe(400);
    expect(sessionCookie).toBeUndefined();
  });

  it('[AUTH-002] fails closed with a 503 page when the Groups API is down', async () => {
    // Arrange
    tb.feide.setGroupsFailure(true);
    // Act
    const { res, sessionCookie } = await loginWithFeide(tb, 'author').finally(() =>
      tb.feide.setGroupsFailure(false),
    );
    // Assert
    expect(res.status).toBe(503);
    expect(res.text).toContain('Vi får ikkje kontakt med Feide');
    expect(sessionCookie).toBeUndefined();
  });

  it.each([
    ['student', { roles: ['learner'], hvlMember: true, studentAuthor: false }],
    ['ppu-student', { roles: ['author'], hvlMember: true, studentAuthor: true }],
    ['uib-employee', { roles: ['learner'], hvlMember: false, studentAuthor: false }],
  ])('[AUTH-002] %s gets the roles of the AUTH-002 table', async (key, expected) => {
    const { sessionCookie } = await loginWithFeide(tb, key);
    expect(await sessionOf(sessionCookie)).toMatchObject(expected);
  });

  it("[AUTH-004] a learner's account has no name or e-mail, and no national ID number is kept in plaintext or logged", async () => {
    // Arrange: Feide releases name, e-mail and (wrongly) a national ID number.
    tb.feide.tamperNextIdToken((payload) => void (payload['https://n.feide.no/claims/nin'] = '01017012345'));
    // Act
    const { sessionCookie } = await loginWithFeide(tb, 'student');
    // Assert
    const user = await tb.db.user.findUniqueOrThrow({
      where: { id: (await sessionOf(sessionCookie))?.userId ?? '' },
    });
    expect(user).toMatchObject({ kind: 'learner', displayName: null, email: null });
    // WHY: values, not only key names: the session holds the ID token, and only encrypted (D-021, D-056).
    const keys = await tb.redis.keys('hvli:*');
    const values = keys.length > 0 ? await tb.redis.mGet(keys) : [];
    const everything = JSON.stringify([user, keys, values, tb.logs]);
    for (const secret of ['01017012345', 'Siri Student', 'student@hvl.no', 'test-only-feide-secret']) {
      expect(everything, secret).not.toContain(secret);
    }
  });

  it('[AUTH-001] refuses a Feide user without a Feide ID with a friendly page and creates nothing', async () => {
    const before = await tb.db.user.count();
    const { res, sessionCookie } = await loginWithFeide(tb, 'no-feide-id');
    expect(res.status).toBe(403);
    expect(res.text).toContain('Feide-kontoen din har ingen Feide-ID');
    expect(sessionCookie).toBeUndefined();
    expect(await tb.db.user.count()).toBe(before);
  });
});
