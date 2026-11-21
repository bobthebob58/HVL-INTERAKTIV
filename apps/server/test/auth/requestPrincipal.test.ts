/**
 * Unit tests for the authentication middleware: where an ltik may travel, which credential wins, and the CSRF
 * check on portal requests. The ltik resolver and the portal session are stubs.
 *
 * Spec: LTI-003, AUTH-003, H5P-007
 */
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import type { LaunchContext } from 'ltijs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { sealPrincipal } from '../../src/auth/Principal.js';
import { ltiSubjectOf, principalOf } from '../../src/auth/principalLocals.js';
import { requestPrincipal, urlTokenOf } from '../../src/auth/requestPrincipal.js';
import type { PortalSession } from '../../src/auth/session/portalSessionRecord.js';
import { HttpError } from '../../src/http/HttpError.js';
import { authError } from '../../src/http/authErrors.js';
import type { ResolvedLtik } from '../../src/lti/ltikPrincipal.js';

const LTIK = 'good.ltik.value';
const ltiPrincipal = sealPrincipal({
  userId: '0192f0c4-0000-7000-8000-000000000001',
  learnerKey: 'lk-lti',
  roles: ['learner'],
  mode: 'lti',
  locale: 'nn',
  hvlMember: false,
  feideAuthenticated: false,
  studentAuthor: false,
  lti: {
    platformId: 'p',
    deploymentId: 'd',
    contextId: 'c',
    messageType: 'LtiResourceLinkRequest',
    contentId: 'c1',
  },
});
const resolveLtik = async (ltik: string): Promise<ResolvedLtik> => {
  if (ltik !== LTIK) throw authError('hvl:ltik-invalid');
  const facts = { subject: 'canvas-sub-1' } as ResolvedLtik['facts'];
  return { principal: ltiPrincipal, context: {} as LaunchContext, facts };
};
const session: PortalSession = {
  userId: '0192f0c4-0000-7000-8000-000000000002',
  roles: ['author'],
  hvlMember: true,
  studentAuthor: false,
  locale: 'nb',
  learnerKey: 'lk-portal',
  learnerKeyYear: 2025,
  csrfToken: 'csrf-token-of-the-session',
  createdAt: new Date(),
  lastSeenAt: new Date(),
};

/** An app whose routes answer with who the request acts as; `signedIn` fakes the portal session middleware. */
function appWith(signedIn: boolean) {
  const fakeSession: RequestHandler = (_req, res, next) => {
    if (signedIn) res.locals.hvliPortalSession = { sid: 'sid', session };
    next();
  };
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    res
      .status(error instanceof HttpError ? error.status : 500)
      .json({ code: (error as HttpError).errorCode });
  };
  return express()
    .use(fakeSession, requestPrincipal(resolveLtik))
    .get('/api/me', (_req, res) => {
      res.json({
        learnerKeyYear: principalOf(res)?.learnerKeyYear ?? null,
        sub: ltiSubjectOf(res) ?? null,
        inPrincipal: JSON.stringify(principalOf(res)).includes('sub-1'),
      });
    })
    .all('/{*path}', (_req, res) => {
      res.json({ mode: principalOf(res)?.mode ?? null, token: urlTokenOf(res)?.name ?? null });
    })
    .use(onError);
}

describe('requestPrincipal', () => {
  describe('the ltik', () => {
    it('[LTI-003] a Bearer ltik makes the request an LTI request, on a path its launch’s pages ask for', async () => {
      const res = await request(appWith(false)).get('/h5p/params/c1').set('Authorization', `Bearer ${LTIK}`);
      expect(res.body).toEqual({ mode: 'lti', token: 'ltik' });
    });

    it.each([
      ['a Bearer ltik on a path outside its launch’s list', '/api/anything', true],
      ['a Bearer ltik on another activity', '/h5p/params/c2', true],
      ['a query ltik on another activity’s state', '/h5p/contentUserData/c2/state/0', false],
    ])('[LTI-003] %s is refused with 403 `hvl:not-from-canvas`', async (_case, path, bearer) => {
      // Arrange
      const asked = bearer
        ? request(appWith(false)).get(path).set('Authorization', `Bearer ${LTIK}`)
        : request(appWith(false)).get(`${path}?ltik=${LTIK}`);
      // Act
      const res = await asked;
      // Assert
      expect([res.status, res.body.code]).toEqual([403, 'hvl:not-from-canvas']);
    });

    it('[AUTH-003] a portal session is not held to the ltik’s list', async () => {
      // Act
      const res = await request(appWith(true)).get('/api/anything');
      // Assert
      expect(res.body).toEqual({ mode: 'portal', token: 'csrf' });
    });

    it.each(['/h5p/ajax', '/h5p/contentUserData/c1/state/0'])(
      '[H5P-007] an ltik in the query is accepted on %s (D-058)',
      async (path) => {
        const res = await request(appWith(false)).get(`${path}?ltik=${LTIK}`);
        expect(res.body.mode).toBe('lti');
      },
    );

    it.each([
      '/h5p/play/c1',
      '/api/content/c1/sharing',
      '/h5p/ajax/extra',
      '/lti/deeplink/response',
      '/lti/play',
      '/lti/deeplink',
      '/h5p/%61jax/x',
    ])('[LTI-003] an ltik in the query is refused on %s', async (path) => {
      const res = await request(appWith(false)).get(`${path}?ltik=${LTIK}`);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('hvl:ltik-invalid');
    });

    it('[LTI-003] a Bearer and a query ltik that differ are refused', async () => {
      const res = await request(appWith(false))
        .get(`/h5p/ajax?ltik=${LTIK}`)
        .set('Authorization', 'Bearer other.ltik.value');
      expect(res.status).toBe(401);
    });

    it('[LTI-003] a repeated ltik query parameter is refused', async () => {
      const res = await request(appWith(false)).get(`/h5p/ajax?ltik=${LTIK}&ltik=${LTIK}`);
      expect(res.status).toBe(401);
    });

    it('[LTI-003] an Authorization header that is not a Bearer token is refused, not ignored', async () => {
      const res = await request(appWith(true)).get('/api/x').set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
    });

    it('[LTI-003] inside Canvas the ltik wins over a portal session cookie', async () => {
      const res = await request(appWith(true)).post('/h5p/ajax').set('Authorization', `Bearer ${LTIK}`);
      expect(res.body).toEqual({ mode: 'lti', token: 'ltik' });
    });
  });

  describe('the portal session', () => {
    it('[AUTH-003] a GET with a session acts as the portal user, with the CSRF token for H5P URLs', async () => {
      const res = await request(appWith(true)).get('/h5p/play/c1');
      expect(res.body).toEqual({ mode: 'portal', token: 'csrf' });
    });

    it('[AUTH-003] an unsafe method without the CSRF token is refused with 401', async () => {
      const res = await request(appWith(true)).post('/api/x');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('hvl:csrf-invalid');
    });

    it('[H5P-007] a GET to the H5P AJAX endpoint needs the CSRF token too', async () => {
      const without = await request(appWith(true)).get('/h5p/ajax?action=content-type-cache');
      const withToken = await request(appWith(true)).get(
        `/h5p/ajax?action=content-type-cache&csrf=${session.csrfToken}`,
      );
      expect(without.status).toBe(401);
      expect(withToken.body.mode).toBe('portal');
    });

    it('[AUTH-003] the CSRF token in a header is accepted on an unsafe method', async () => {
      const res = await request(appWith(true)).patch('/api/x').set('x-csrf-token', session.csrfToken);
      expect(res.body.mode).toBe('portal');
    });

    it('[DATA-012] a portal principal carries the academic year its session stored with the learnerKey (D-107)', async () => {
      const portal = await request(appWith(true)).get('/api/me');
      const lti = await request(appWith(false)).get('/api/me').set('Authorization', `Bearer ${LTIK}`);
      expect(portal.body).toMatchObject({ learnerKeyYear: 2025 });
      expect(lti.body).toMatchObject({ learnerKeyYear: null });
    });

    it('[LTI-012] keeps an LTI request’s sub beside the principal, never in it, and a portal request has none', async () => {
      const lti = await request(appWith(false)).get('/api/me').set('Authorization', `Bearer ${LTIK}`);
      const portal = await request(appWith(true)).get('/api/me');
      expect(lti.body).toMatchObject({ sub: 'canvas-sub-1', inPrincipal: false });
      expect(portal.body).toMatchObject({ sub: null, inPrincipal: false });
    });

    it('[AUTH-003] without a session or an ltik the request has no principal', async () => {
      const res = await request(appWith(false)).get('/api/x');
      expect(res.body).toEqual({ mode: null, token: null });
    });
  });
});
