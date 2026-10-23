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
import { principalOf } from '../../src/auth/principalLocals.js';
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
  lti: { platformId: 'p', deploymentId: 'd', contextId: 'c', messageType: 'LtiResourceLinkRequest' },
});
const resolveLtik = async (ltik: string): Promise<ResolvedLtik> => {
  if (ltik !== LTIK) throw authError('hvl:ltik-invalid');
  return { principal: ltiPrincipal, context: {} as LaunchContext, facts: {} as ResolvedLtik['facts'] };
};
const session: PortalSession = {
  userId: '0192f0c4-0000-7000-8000-000000000002',
  roles: ['author'],
  hvlMember: true,
  studentAuthor: false,
  locale: 'nb',
  learnerKey: 'lk-portal',
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
    .all('/{*path}', (_req, res) => {
      res.json({ mode: principalOf(res)?.mode ?? null, token: urlTokenOf(res)?.name ?? null });
    })
    .use(onError);
}

describe('requestPrincipal', () => {
  describe('the ltik', () => {
    it('[LTI-003] a Bearer ltik makes the request an LTI request, on any path', async () => {
      const res = await request(appWith(false)).get('/api/anything').set('Authorization', `Bearer ${LTIK}`);
      expect(res.body).toEqual({ mode: 'lti', token: 'ltik' });
    });

    it.each(['/h5p/ajax', '/h5p/contentUserData/c1/state/0', '/lti/play', '/lti/deeplink'])(
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
      const res = await request(appWith(true)).post('/api/x').set('Authorization', `Bearer ${LTIK}`);
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

    it('[AUTH-003] without a session or an ltik the request has no principal', async () => {
      const res = await request(appWith(false)).get('/api/x');
      expect(res.body).toEqual({ mode: null, token: null });
    });
  });
});
