/**
 * Integration tests that malformed author and learner input is refused as the client's error (4xx), never
 * answered with a server fault: text PostgreSQL cannot store, nesting Lumi's recursive walks cannot follow,
 * values whose JSON type Lumi's scanners cannot read, and a sub-content name that cannot be printed.
 *
 * Spec: PROD-012, H5P-004, SEC-005
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildH5pPackage, removeBuiltPackages } from '../support/h5pPackageBuilder.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import { MULTI_CHOICE } from '../support/tenTypeLibraries.js';

const nested = (levels: number): unknown => {
  let value: unknown = 'x';
  for (let i = 0; i < levels; i += 1) value = [value];
  return value;
};

describeWithServices('Malformed content input over HTTP', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
  }, 60_000);
  afterAll(async () => {
    removeBuiltPackages();
    await tb.close();
  });

  const save = (
    params: object,
    metadata: object = { title: 'Q', license: 'U' },
    library = 'H5P.MultiChoice 1.16',
  ) =>
    request(tb.app)
      .post('/h5p/content')
      .set(...author.header)
      .send({ library, params: { params, metadata } });

  it('[PROD-012] text PostgreSQL cannot store (U+0000, a lone surrogate) is a 400, in values, keys and titles', async () => {
    // Arrange
    const cases: [object, object?][] = [
      [{ question: 'a\u0000b' }],
      [{ question: 'ok', ['a\u0000b']: 1 }],
      [{ question: '\udc00' }],
      [{ question: 'ok' }, { title: 'S\ud800', license: 'U' }],
    ];
    // Act and assert: each is refused as the request's fault; an emoji (a surrogate pair) is fine.
    for (const [params, metadata] of cases) {
      const res = await save(params, metadata);
      expect(res.status, JSON.stringify(params)).toBe(400);
      expect(res.body).toMatchObject({ errorCode: 'hvl:unstorable-text' });
    }
    expect((await save({ question: 'Kva? 🙂' })).status).toBe(201);
  });

  it('[PROD-012] a learner state with U+0000 is a 400, and nothing is stored', async () => {
    // Arrange
    const id = await tb.activity(author, { published: true });
    const learner = await tb.actor('learner');
    // Act
    const res = await request(tb.app)
      .post(`/h5p/contentUserData/${id}/state/0`)
      .set(...learner.header)
      .type('form')
      .send({ data: '{"a":"x\u0000y"}', preload: '1', invalidate: '1' });
    // Assert
    expect(res.status).toBe(400);
    expect(await tb.db.h5PUserData.count({ where: { contentId: id } })).toBe(0);
  });

  it('[PROD-012][SEC-005] content nested deeper than Lumi can walk is a 400, on save and on import', async () => {
    // Act and assert: a save with 3 000 nested arrays (about 6 KB)
    const res = await save({ question: 'Kva?', extra: nested(3000) });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'hvl:content-too-deep' });
    expect((await save({ question: 'Kva?', extra: nested(100) })).status).toBe(201);
    // Act and assert: the same content.json in an imported package
    const pkg = await buildH5pPackage({
      main: MULTI_CHOICE,
      params: { question: 'Kva?', extra: nested(3000) },
    });
    const imported = await request(tb.app)
      .post('/h5p/ajax?action=library-upload')
      .set(...author.header)
      .attach('h5p', pkg);
    expect(imported.status).toBe(400);
    expect(imported.body).toMatchObject({ errorCode: 'hvl:content-too-deep' });
  });

  it('[PROD-012] a value whose JSON type does not fit its field is a 400, not a crash', async () => {
    // Arrange: each crashed one of Lumi's scanners with a TypeError before.
    const cases: [object, string][] = [
      [{ question: ['x'] }, '$.question'],
      [{ question: true }, '$.question'],
      [{ question: 'ok', answers: { a: 'x' } }, '$.answers'],
      [{ question: 'ok', answers: 'x' }, '$.answers'],
      [{ question: 'ok', media: { path: 5 } }, '$.media'],
      [{ question: 'ok', attachment: null }, '$.attachment'],
    ];
    // Act and assert
    for (const [params, path] of cases) {
      const res = await save(params);
      expect(res.status, path).toBe(400);
      expect(res.body).toMatchObject({ errorCode: 'hvl:invalid-params' });
    }
    expect((await save({ question: 5, answers: [null, 'Ja'] })).status).toBe(201);
  });

  it('[PROD-012] a sub-content name that is an object without a usable toString is refused with 403', async () => {
    for (const library of [{ toString: 1 }, [{ toString: 1 }]]) {
      const res = await save({ questions: [{ library, params: {} }] }, undefined, 'H5P.QuestionSet 1.21');
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ errorCode: 'hvl:sub-content-not-allowed' });
    }
  });
});
