/**
 * Integration tests of what an ltik reaches through the whole app (D-130): after a real launch from the mock
 * Canvas an author still reads and saves the launched activity, while listing, creating, deleting, downloading,
 * copying, publishing, sharing and another activity of the same account are refused with 403
 * `hvl:not-from-canvas` and change nothing; a Deep Linking ltik reaches no activity at all.
 *
 * Spec: LTI-003, LTI-004, LTI-006, PROD-007
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { OWN_PAGE_FETCH } from '../support/ownPageFetch.js';
import { describeWithServices } from '../support/services.js';

const REFUSED = { errorCode: 'hvl:not-from-canvas', httpStatusCode: 403 };
const metadata = { title: 'Celler', license: 'U' };

describeWithServices('[LTI-003] what an ltik reaches', () => {
  let tb: AppTestbed;
  let launched: string;
  let other: string;
  let ltik: string;
  let author: string;
  const launch = async (spec: Parameters<typeof launchFromCanvas>[2]) =>
    (await launchFromCanvas(tb.app, tb.mock.canvas, { user: CANVAS_USERS.teacher, ...spec })).ltik ?? '';
  const as = (token: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string) =>
    request(tb.app)[method](path).set(OWN_PAGE_FETCH).set('Authorization', `Bearer ${token}`);
  beforeAll(async () => {
    tb = await openAppTestbed();
    const first = await tb.activity(await tb.staffAccount(), { published: true });
    author = (await tb.lti.resolveLtik(await launch({ custom: { contentId: first } }))).principal.userId;
    launched = await tb.activity(author, { published: true });
    other = await tb.activity(author, { published: true });
    ltik = await launch({ custom: { contentId: launched }, resourceLinkId: 'scope-link' });
  }, 60_000);
  afterAll(() => tb.close());
  const stored = () => tb.db.h5PContent.findMany({ where: { ownerUserId: author }, orderBy: { id: 'asc' } });

  it('[LTI-006] the author reads and saves the launched activity, and asks who they are', async () => {
    // Act
    const me = await as(ltik, 'get', '/api/me');
    const params = await as(ltik, 'get', `/h5p/params/${launched}`);
    const library = (params.body as { library: string }).library;
    const saved = await as(ltik, 'put', `/h5p/content/${launched}`).send({
      library,
      params: { params: (params.body as { params: { params: object } }).params.params, metadata },
    });
    const insight = await as(ltik, 'get', `/api/content/${launched}/insight`);
    // Assert
    expect([me.status, params.status, saved.status]).toEqual([200, 200, 200]);
    expect(me.body).toMatchObject({ kind: 'lti', roles: ['author'] });
    expect(insight.body).not.toMatchObject({ errorCode: 'hvl:not-from-canvas' });
  });

  it('[PROD-007] listing, creating, deleting, downloading, copying, publishing and sharing are refused, and nothing changes', async () => {
    // Arrange
    const before = await stored();
    const body = { library: 'H5P.MultiChoice 1.16', params: { params: { question: 'Kva?' }, metadata } };
    // Act
    const answers = [
      await as(ltik, 'get', '/api/content'),
      await as(ltik, 'get', `/api/content/${launched}`),
      await as(ltik, 'post', '/h5p/content').send(body),
      await as(ltik, 'delete', `/h5p/content/${launched}`),
      await as(ltik, 'get', `/h5p/download/${launched}`),
      await as(ltik, 'post', `/h5p/content/${launched}/copy`).send(body.params),
      await as(ltik, 'post', `/api/content/${launched}/unpublish`).send({}),
      await as(ltik, 'post', `/api/content/${launched}/publish`).send({}),
      await as(ltik, 'patch', `/api/content/${launched}/sharing`).send({ visibility: 'hvl' }),
    ];
    // Assert
    expect(answers.map((res) => res.status)).toEqual(answers.map(() => 403));
    expect(answers.map((res) => res.body as object)).toMatchObject(answers.map(() => REFUSED));
    expect(answers[0]?.body.message).toBe(
      'Dette kan du ikkje gjere frå Canvas. Opne HVL Interaktiv i portalen for å gjere det.',
    );
    expect(await stored()).toEqual(before);
  });

  it('[LTI-003] another activity of the same account is out of reach: read, save, state and insight', async () => {
    // Arrange
    const before = await stored();
    // Act
    const answers = [
      await as(ltik, 'get', `/h5p/params/${other}`),
      await as(ltik, 'put', `/h5p/content/${other}`).send({ library: 'x', params: { params: {}, metadata } }),
      await as(ltik, 'get', `/h5p/contentUserData/${other}/state/0`),
      await as(ltik, 'get', `/api/content/${other}/insight`),
      await as(ltik, 'get', `/api/content/${other}/grade-sync`),
    ];
    // Assert
    expect(answers.map((res) => res.body as object)).toMatchObject(answers.map(() => REFUSED));
    expect(await stored()).toEqual(before);
  });

  it('[LTI-004] a Deep Linking ltik asks who it is and reaches no activity', async () => {
    // Arrange
    const picker = await launch({ messageType: 'LtiDeepLinkingRequest' });
    // Act
    const me = await as(picker, 'get', '/api/me');
    const answers = [
      await as(picker, 'get', '/api/content'),
      await as(picker, 'get', `/h5p/params/${launched}`),
      await as(picker, 'put', `/h5p/content/${launched}`).send({}),
      await as(picker, 'delete', `/h5p/content/${launched}`),
    ];
    // Assert
    expect(picker).not.toBe('');
    expect(me.status).toBe(200);
    expect(answers.map((res) => res.body as object)).toMatchObject(answers.map(() => REFUSED));
  });

  it('[LTI-003] an ltik that is not valid is still 401, whatever it asks for', async () => {
    // Act
    const res = await as('not-a-token', 'get', '/api/content');
    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ errorCode: 'hvl:ltik-invalid' });
  });
});
