/**
 * Integration tests for `GET /api/me` and the notice dismissals: what the web app learns about the person, and how a
 * dismissed notice is remembered per user.
 *
 * Spec: DATA-002, PROD-011
 */
import { meSchema } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, expect, it } from 'vitest';
import { openApiTestbed } from '../../support/apiTestbed.js';
import { describeWithServices } from '../../support/services.js';

describeWithServices('[PROD-011] me and notices', () => {
  const tb = openApiTestbed();
  afterAll(() => tb.close());

  const notice = (id: string) => `/api/me/notices/${id}`;

  it('[DATA-002] me gives mode, language, roles and dismissals, and never a name, e-mail or ID', async () => {
    // Arrange
    const author = await tb.principal('author', { locale: 'nb' });
    await tb.db.user.update({
      where: { id: author.principal.userId },
      data: { displayName: 'Aud Forfattar', email: 'aud@hvl.no' },
    });
    // Act
    const res = await request(tb.app)
      .get('/api/me')
      .set(...author.header);
    // Assert
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(meSchema.parse(res.body)).toEqual({
      kind: 'portal',
      locale: 'nb',
      roles: ['author'],
      dismissedNotices: [],
    });
    expect(res.text).not.toMatch(new RegExp(`Aud|aud@hvl.no|${author.principal.userId}|learner-`));
  });

  it('[PROD-011] a dismissal is stored per user, shown in me, and replaced by a newer version', async () => {
    // Arrange
    const author = await tb.principal('author');
    const other = await tb.principal('author');
    // Act
    const first = await request(tb.app)
      .put(notice('formative-use'))
      .set(...author.header)
      .send({ version: 1 });
    const second = await request(tb.app)
      .put(notice('formative-use'))
      .set(...author.header)
      .send({ version: 2 });
    const me = await request(tb.app)
      .get('/api/me')
      .set(...author.header);
    const otherMe = await request(tb.app)
      .get('/api/me')
      .set(...other.header);
    // Assert
    expect([first.status, second.status]).toEqual([204, 204]);
    expect(me.body.dismissedNotices).toEqual([{ noticeId: 'formative-use', version: 2 }]);
    expect(otherMe.body.dismissedNotices).toEqual([]);
    const rows = await tb.db.noticeDismissal.findMany({ where: { userId: author.principal.userId } });
    expect(rows).toEqual([expect.objectContaining({ noticeId: 'formative-use', noticeVersion: 2 })]);
  });

  it('[PROD-011] learners never see the notices: 403, nothing stored, no dismissals in me', async () => {
    // Arrange
    const learner = await tb.principal('learner');
    // Act
    const res = await request(tb.app)
      .put(notice('formative-use'))
      .set(...learner.header)
      .send({ version: 1 });
    const me = await request(tb.app)
      .get('/api/me')
      .set(...learner.header);
    // Assert
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('error.forbidden');
    expect(await tb.db.noticeDismissal.count({ where: { userId: learner.principal.userId } })).toBe(0);
    expect(me.body).toMatchObject({ roles: ['learner'], dismissedNotices: [] });
  });

  it('[PROD-011] an unknown notice is 404, a bad version 400, and nobody signed in 401', async () => {
    // Arrange
    const author = await tb.principal('author');
    const put = (id: string, body: object) =>
      request(tb.app)
        .put(notice(id))
        .set(...author.header)
        .send(body);
    // Act and assert
    expect((await put('privacy', { version: 1 })).status).toBe(404);
    for (const body of [{ version: 0 }, { version: '1' }, { version: 1.5 }, {}, { version: 1, at: 'now' }]) {
      expect((await put('formative-use', body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await request(tb.app).get('/api/me')).status).toBe(401);
    expect((await request(tb.app).put(notice('formative-use')).send({ version: 1 })).status).toBe(401);
  });

  it('[PROD-011] dismissals are deleted with the account', async () => {
    // Arrange
    const author = await tb.principal('author');
    await request(tb.app)
      .put(notice('formative-use'))
      .set(...author.header)
      .send({ version: 3 });
    // Act
    await tb.db.user.delete({ where: { id: author.principal.userId } });
    // Assert
    expect(await tb.db.noticeDismissal.count({ where: { userId: author.principal.userId } })).toBe(0);
  });
});
