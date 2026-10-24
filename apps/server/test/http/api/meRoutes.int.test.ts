/**
 * Integration tests for `GET /api/me` and the notice dismissals: what the web app learns about the person, and how a
 * dismissed notice is remembered per user.
 *
 * Spec: DATA-002, PROD-011
 */
import { meSchema, NOTICE_VERSIONS } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, expect, it } from 'vitest';
import { openApiTestbed } from '../../support/apiTestbed.js';
import { describeWithServices } from '../../support/services.js';
import { requestAs } from '../../support/requestAs.js';

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
    const res = await requestAs(tb.app, author, 'get', '/api/me');
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

  it('[PROD-011] a dismissal is stored per user, shown in me, and replaces the earlier one', async () => {
    // Arrange
    const author = await tb.principal('author');
    const other = await tb.principal('author');
    const version = NOTICE_VERSIONS['formative-use'];
    const earlier = new Date(Date.now() - 60_000);
    await tb.db.noticeDismissal.create({
      data: {
        userId: author.principal.userId,
        noticeId: 'formative-use',
        noticeVersion: version,
        at: earlier,
      },
    });
    // Act
    const res = await requestAs(tb.app, author, 'put', notice('formative-use')).send({ version });
    const me = await requestAs(tb.app, author, 'get', '/api/me');
    const otherMe = await requestAs(tb.app, other, 'get', '/api/me');
    // Assert
    expect(res.status).toBe(204);
    expect(me.body.dismissedNotices).toEqual([{ noticeId: 'formative-use', version }]);
    expect(otherMe.body.dismissedNotices).toEqual([]);
    const rows = await tb.db.noticeDismissal.findMany({ where: { userId: author.principal.userId } });
    expect(rows).toEqual([expect.objectContaining({ noticeId: 'formative-use', noticeVersion: version })]);
    expect(rows[0]?.at.getTime()).toBeGreaterThan(earlier.getTime());
  });

  it('[PROD-011] a version newer than the current notice is 400 and stored nowhere, also beyond the INTEGER range', async () => {
    // Arrange
    const author = await tb.principal('author');
    const current = NOTICE_VERSIONS['formative-use'];
    const put = (version: number) =>
      requestAs(tb.app, author, 'put', notice('formative-use')).send({ version });
    // Act
    const future = await put(current + 1);
    const outOfRange = await put(2_147_483_648);
    const me = await requestAs(tb.app, author, 'get', '/api/me');
    // Assert
    expect([future.status, outOfRange.status]).toEqual([400, 400]);
    expect(outOfRange.body.errorCode).toBe('error.badRequest');
    expect(me.body.dismissedNotices).toEqual([]);
    expect(await tb.db.noticeDismissal.count({ where: { userId: author.principal.userId } })).toBe(0);
  });

  it('[PROD-011] learners never see the notices: 403, nothing stored, no dismissals in me', async () => {
    // Arrange
    const learner = await tb.principal('learner');
    // Act
    const res = await requestAs(tb.app, learner, 'put', notice('formative-use')).send({ version: 1 });
    const me = await requestAs(tb.app, learner, 'get', '/api/me');
    // Assert
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('error.forbidden');
    expect(await tb.db.noticeDismissal.count({ where: { userId: learner.principal.userId } })).toBe(0);
    expect(me.body).toMatchObject({ roles: ['learner'], dismissedNotices: [] });
  });

  it('[PROD-011] an unknown notice is 404, a bad version 400, and nobody signed in 401', async () => {
    // Arrange
    const author = await tb.principal('author');
    const put = (id: string, body: object) => requestAs(tb.app, author, 'put', notice(id)).send(body);
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
    await requestAs(tb.app, author, 'put', notice('formative-use')).send({
      version: NOTICE_VERSIONS['formative-use'],
    });
    // Act
    await tb.db.user.delete({ where: { id: author.principal.userId } });
    // Assert
    expect(await tb.db.noticeDismissal.count({ where: { userId: author.principal.userId } })).toBe(0);
  });
});
