/**
 * Integration tests for saving, loading, deleting and exporting an activity over HTTP: stored markup is inert,
 * only owners change their activities, and refusals never look like downloads.
 *
 * Spec: H5P-002, H5P-006, SEC-003, SEC-008
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import { rawBody } from '../support/uploadFixtures.js';

const XSS = '<img src=x onerror=alert(1)>svar';
const META = { title: 'Aktivitet', license: 'U', language: 'nn' };
const mcBody = (question: string, metadata: object = META) => ({
  library: 'H5P.MultiChoice 1.16',
  params: { params: { question, answers: [XSS, 'Nei'] }, metadata },
});

describeWithServices('H5P content over HTTP', () => {
  let tb: HttpTestbed;
  let owner: TestActor;
  let colleague: TestActor;
  let learner: TestActor;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    owner = await tb.actor('author');
    colleague = await tb.actor('author');
    learner = await tb.actor('learner');
  }, 60_000);
  afterAll(() => tb.close());

  const create = async (body: object = mcBody('Kva er rett?')): Promise<string> => {
    const res = await request(tb.app)
      .post('/h5p/content')
      .set(...owner.header)
      .send(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return (res.body as { contentId: string }).contentId;
  };

  it('[SEC-008] markup in a text field, a list item and the title is stored inert', async () => {
    const id = await create(mcBody(XSS, { ...META, title: XSS }));
    const res = await request(tb.app)
      .get(`/h5p/params/${id}`)
      .set(...owner.header);
    expect(res.status).toBe(200);
    const stored = JSON.stringify(res.body);
    expect(stored).not.toContain('<img');
    expect(stored).not.toMatch(/<[^>]*onerror/i);
    const row = await tb.db.h5PContent.findUniqueOrThrow({ where: { id } });
    expect(JSON.stringify([row.params, row.metadata, row.title])).not.toContain('<img');
  });

  it('[H5P-006] the owner updates the activity; a colleague can neither read nor change it', async () => {
    const id = await create();
    const own = await request(tb.app)
      .put(`/h5p/content/${id}`)
      .set(...owner.header)
      .send(mcBody('Ny tekst'));
    expect(own.status).toBe(200);
    expect(own.body).toEqual({ contentId: id });
    const read = await request(tb.app)
      .get(`/h5p/params/${id}`)
      .set(...colleague.header);
    const write = await request(tb.app)
      .put(`/h5p/content/${id}`)
      .set(...colleague.header)
      .send(mcBody('Kapra'));
    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    const row = await tb.db.h5PContent.findUniqueOrThrow({ where: { id } });
    expect(JSON.stringify(row.params)).toContain('Ny tekst');
  });

  it('[H5P-006] learners never reach saving, loading parameters or deleting', async () => {
    const id = await create();
    const calls = [
      request(tb.app)
        .post('/h5p/content')
        .set(...learner.header)
        .send(mcBody('x')),
      request(tb.app)
        .put(`/h5p/content/${id}`)
        .set(...learner.header)
        .send(mcBody('x')),
      request(tb.app)
        .get(`/h5p/params/${id}`)
        .set(...learner.header),
      request(tb.app)
        .delete(`/h5p/content/${id}`)
        .set(...learner.header),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(403);
  });

  it('[H5P-006] only the owner deletes; the activity is gone afterwards', async () => {
    const id = await create();
    expect(
      (
        await request(tb.app)
          .delete(`/h5p/content/${id}`)
          .set(...colleague.header)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(tb.app)
          .delete(`/h5p/content/${id}`)
          .set(...owner.header)
      ).status,
    ).toBe(204);
    expect(await tb.db.h5PContent.findUnique({ where: { id } })).toBeNull();
    expect(
      (
        await request(tb.app)
          .get(`/h5p/params/${id}`)
          .set(...owner.header)
      ).status,
    ).toBe(403);
  });

  it('[H5P-006] the owner downloads a .h5p package; a refusal is JSON, never an attachment', async () => {
    const id = await create();
    const ok = await request(tb.app)
      .get(`/h5p/download/${id}`)
      .set(...owner.header)
      .buffer(true)
      .parse(rawBody);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-disposition']).toBe(`attachment; filename="${id}.h5p"`);
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    expect((ok.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    const refused = await request(tb.app)
      .get(`/h5p/download/${id}`)
      .set(...learner.header);
    expect(refused.status).toBe(403);
    expect(refused.headers['content-disposition']).toBeUndefined();
    expect(refused.headers['content-type']).toMatch(/^application\/json/);
  });

  it('[H5P-002] a malformed save or an unknown activity is refused without saving anything', async () => {
    const before = await tb.db.h5PContent.count({ where: { ownerUserId: owner.actor.accountId } });
    const malformed = await request(tb.app)
      .post('/h5p/content')
      .set(...owner.header)
      .send({ library: 'H5P.MultiChoice 1.16', params: { params: [] } });
    expect(malformed.status).toBe(400);
    const unknown = await request(tb.app)
      .put(`/h5p/content/${randomUUID()}`)
      .set(...owner.header)
      .send(mcBody('x'));
    expect(unknown.status).toBe(403);
    expect(await tb.db.h5PContent.count({ where: { ownerUserId: owner.actor.accountId } })).toBe(before);
  });
});
