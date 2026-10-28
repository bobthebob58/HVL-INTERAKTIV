/**
 * Integration tests for the `/api` surface through the whole app: the registry, the OpenAPI document, the
 * authentication of the new routes and the save gate's version count.
 *
 * Spec: DOC-012, PROD-011, PROD-003
 */
import {
  API_ROUTES,
  buildOpenApiDocument,
  CSRF_HEADER_NAME,
  PORTAL_SESSION_COOKIE,
  type ApiRoute,
} from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CSRF_HEADER } from '../../../src/auth/session/csrfToken.js';
import { SESSION_COOKIE } from '../../../src/auth/session/sessionCookies.js';
import { PrismaContentAccessRepository } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { apiRouter } from '../../../src/http/api/apiRouter.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { mountedRoutes } from '../../support/expressRoutes.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

// WHY: one sample value per path or query parameter name any area uses, so a workstream that adds a route with
// these names never edits this test; an unknown name fails loudly. A public (`auth: 'none'`) route must answer 200
// to these samples.
const SAMPLE_PARAMETERS: Readonly<Record<string, () => string>> = {
  contentId: () => crypto.randomUUID(),
  noticeId: () => 'formative-use',
  userId: () => crypto.randomUUID(),
  patternId: () => 'fa-video',
  locale: () => 'nn',
  courseCode: () => 'SYK110',
  q: () => 'Kari',
  format: () => 'md',
};
const sampleParameter = (name: string): string => {
  const sample = SAMPLE_PARAMETERS[name];
  if (!sample) throw new Error(`apiDocs test: add a sample value for the parameter "${name}"`);
  return sample();
};

describeWithServices('[DOC-012] the /api surface', () => {
  let tb: AppTestbed;
  let cookie: string;
  let csrf: string;
  const routerFor = (serveDocs: boolean) =>
    apiRouter({
      publishing: { db: tb.db, validator: () => [], clock: () => new Date() },
      access: new PrismaContentAccessRepository(tb.db),
      studio: tb.studio,
      serveDocs,
    });
  const portal = (method: 'put' | 'post', path: string) =>
    request(tb.app)[method](path).set('Cookie', cookie).set(CSRF_HEADER, csrf);

  beforeAll(async () => {
    tb = await openAppTestbed();
    cookie = (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author')).sessionCookie ?? '';
    csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
  }, 60_000);
  afterAll(() => tb.close());

  it('[DOC-012] every route the /api router mounts is in the registry, and every registered route is mounted', () => {
    // Act
    const mounted = mountedRoutes(routerFor(true)).map((r) => `${r.method} ${r.path}`);
    const inProduction = mountedRoutes(routerFor(false)).map((r) => r.path);
    // Assert
    expect(mounted.sort()).toEqual(API_ROUTES.map((r) => `${r.method} ${r.path}`).sort());
    expect(mounted).toContain('patch /content/:contentId/sharing');
    expect(inProduction).not.toContain('/docs');
  });

  it('[DOC-012] the app serves the document, and every registered route answers through the app', async () => {
    // Act
    const docs = await request(tb.app).get('/api/docs');
    const unknown = await request(tb.app).get('/api/nothing-here');
    // Assert
    expect(docs.status).toBe(200);
    expect(docs.body).toEqual(JSON.parse(JSON.stringify(buildOpenApiDocument())));
    const routes: readonly ApiRoute[] = API_ROUTES;
    for (const route of routes) {
      expect(docs.body.paths[`/api${route.path.replace(/:(\w+)/g, '{$1}')}`]?.[route.method]).toBeDefined();
      const path = route.path.replace(/:(\w+)/g, (_, name: string) => sampleParameter(name));
      const query = new URLSearchParams(
        Object.keys(route.query?.shape ?? {}).map((name) => [name, sampleParameter(name)]),
      ).toString();
      const res = await request(tb.app)[route.method](`/api${path}${query ? `?${query}` : ''}`);
      // WHY: nobody is signed in, so a mounted route says 401; only an unmounted path gets the 404 fallback.
      expect(res.status, `${route.method} ${route.path}`).toBe(route.auth === 'none' ? 200 : 401);
    }
    expect(unknown.status).toBe(404);
    expect(unknown.body.errorCode).toBe('error.notFound');
  });

  it('[DOC-012] the document’s security schemes name the server’s real session cookie and CSRF header', () => {
    expect(PORTAL_SESSION_COOKIE).toBe(SESSION_COOKIE);
    expect(CSRF_HEADER_NAME).toBe(CSRF_HEADER);
  });

  it('[PROD-011] a portal author dismisses a notice only with the CSRF token; a Canvas learner reads me by ltik', async () => {
    // Arrange
    const published = await tb.activity(await tb.staffAccount(), { published: true });
    const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, { custom: { contentId: published } });
    // Act
    const without = await request(tb.app)
      .put('/api/me/notices/formative-use')
      .set('Cookie', cookie)
      .send({ version: 1 });
    const withToken = await portal('put', '/api/me/notices/formative-use').send({ version: 1 });
    const portalMe = await request(tb.app).get('/api/me').set('Cookie', cookie);
    const ltiMe = await request(tb.app)
      .get('/api/me')
      .set('Authorization', `Bearer ${ltik ?? ''}`);
    // Assert
    expect(without.status).toBe(401);
    expect(without.body.errorCode).toBe('hvl:csrf-invalid');
    expect(withToken.status).toBe(204);
    expect(portalMe.body).toMatchObject({
      kind: 'portal',
      roles: expect.arrayContaining(['author']),
      dismissedNotices: [{ noticeId: 'formative-use', version: 1 }],
    });
    expect(ltiMe.body).toEqual({
      kind: 'lti',
      locale: expect.any(String),
      roles: ['learner'],
      dismissedNotices: [],
    });
  });

  it('[PROD-003] through the app, an author publishes with the CSRF token and every save counts a version', async () => {
    // Arrange
    const body = {
      library: 'H5P.MultiChoice 1.16',
      params: { params: { question: 'Kva?', answers: ['Ja'] }, metadata: { title: 'Q', license: 'U' } },
    };
    const id = (await portal('post', '/h5p/content').send(body)).body.contentId as string;
    // Act
    const draftSave = await portal('put', `/h5p/content/${id}`).send(body);
    const { updatedAt } = (await request(tb.app).get(`/api/content/${id}/findings`).set('Cookie', cookie))
      .body;
    const published = await portal('post', `/api/content/${id}/publish`).send({
      updatedAt,
      acknowledgements: [],
    });
    const publishedSave = await portal('put', `/h5p/content/${id}`).send(body);
    // Assert
    expect([draftSave.status, published.status, publishedSave.status]).toEqual([200, 200, 200]);
    expect(await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'published',
      version: 3,
    });
  });
});
