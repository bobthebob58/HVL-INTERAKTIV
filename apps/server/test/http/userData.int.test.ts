/**
 * Integration tests for learner state over HTTP: resume after reload, one state per course, the pseudonym as
 * key, no access to other learners, and reset with `data=0`.
 *
 * Spec: H5P-005, PROD-008, H5P-006, DATA-002
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../src/i18n/translate.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('H5P learner state over HTTP', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let published: string;
  let draft: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    const body = {
      library: 'H5P.MultiChoice 1.16',
      params: { params: { question: 'Kva?', answers: ['Ja'] }, metadata: { title: 'Q', license: 'U' } },
    };
    const save = async () =>
      (
        (
          await request(tb.app)
            .post('/h5p/content')
            .set(...author.header)
            .send(body)
        ).body as { contentId: string }
      ).contentId;
    published = await save();
    draft = await save();
    await tb.db.h5PContent.update({
      where: { id: published },
      data: { status: 'published', visibility: 'organisation' },
    });
  }, 60_000);
  afterAll(() => tb.close());

  const url = (contentId: string, query = '') => `/h5p/contentUserData/${contentId}/state/0${query}`;
  const save = (who: TestActor, contentId: string, data: string, query = '') =>
    request(tb.app)
      .post(url(contentId, query))
      .set(...who.header)
      .type('form')
      .send({ data, preload: '1', invalidate: '1' });
  const load = (who: TestActor, contentId: string, query = '') =>
    request(tb.app)
      .get(url(contentId, query))
      .set(...who.header);

  it('[H5P-005][PROD-008] a learner resumes their answers after a reload; nothing stored reads as false', async () => {
    const learner = await tb.actor('learner');
    expect((await load(learner, published)).body).toEqual({ success: true, data: false });
    expect((await save(learner, published, '{"answers":[1]}')).body).toEqual({ success: true });
    expect((await load(learner, published)).body).toEqual({ success: true, data: '{"answers":[1]}' });
  });

  it('[DATA-002] state is stored under the learner’s pseudonym, never the account ID', async () => {
    const learner = await tb.actor('learner');
    await save(learner, published, '{"p":2}');
    const rows = await tb.db.h5PUserData.findMany({
      where: { contentId: published, learnerKey: learner.actor.learnerKey },
    });
    expect(rows).toHaveLength(1);
    const anyByAccount = await tb.db.h5PUserData.count({ where: { learnerKey: learner.actor.accountId } });
    expect(anyByAccount).toBe(0);
  });

  it('[H5P-005] the same learner has separate state in each course; the query cannot pick the course', async () => {
    const inA = await tb.actor('learner', { contextId: 'course-a' });
    const inB = await tb.actor('learner', { learnerKey: inA.actor.learnerKey, contextId: 'course-b' });
    await save(inA, published, '{"course":"a"}');
    expect((await load(inB, published)).body).toEqual({ success: true, data: false });
    expect((await load(inB, published, '?contextId=course-a')).body).toEqual({ success: true, data: false });
    await save(inB, published, '{"course":"b"}', '?contextId=course-a');
    expect((await load(inA, published)).body).toEqual({ success: true, data: '{"course":"a"}' });
  });

  it('[H5P-006] one learner never reads or writes another learner’s state; asUserId is refused', async () => {
    const alice = await tb.actor('learner');
    const bob = await tb.actor('learner');
    await save(alice, published, '{"secret":1}');
    expect((await load(bob, published)).body).toEqual({ success: true, data: false });
    const asAlice = `?asUserId=${encodeURIComponent(alice.actor.learnerKey)}`;
    for (const res of [await load(bob, published, asAlice), await save(bob, published, '{}', asAlice)]) {
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ message: t('h5p.userData.asUserNotSupported', {}, 'nn') });
    }
    expect((await load(alice, published)).body).toEqual({ success: true, data: '{"secret":1}' });
  });

  it('[H5P-005] data=0 resets the state (H5P’s “retry”)', async () => {
    const learner = await tb.actor('learner');
    await save(learner, published, '{"x":1}');
    await save(learner, published, '0');
    expect((await load(learner, published)).body).toEqual({ success: true, data: false });
  });

  it('[H5P-006] a learner has no state on a draft, and an author previewing gets their own', async () => {
    const learner = await tb.actor('learner');
    expect((await load(learner, draft)).status).toBe(403);
    expect((await save(learner, draft, '{}')).status).toBe(403);
    expect((await save(author, draft, '{"preview":1}')).status).toBe(200);
    expect((await load(author, draft)).body).toEqual({ success: true, data: '{"preview":1}' });
  });

  it('[H5P-005] a body without a data string is refused', async () => {
    const learner = await tb.actor('learner');
    const res = await request(tb.app)
      .post(url(published))
      .set(...learner.header)
      .type('form')
      .send({ preload: '1' });
    expect(res.status).toBe(400);
  });
});
