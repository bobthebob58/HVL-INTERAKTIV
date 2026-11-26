/**
 * Integration tests that content past the limits for one activity (D-126) is refused at every door with 400
 * `hvl:content-too-large` and stores nothing: a new activity, an edit, a copy, an imported package, pasted
 * content and a stored row opened for editing; that a save request over 6 MB is refused by its size; and that
 * the largest content inside the limits is saved in good time.
 *
 * Spec: SEC-005, PROD-012
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaContentAccessRepository } from '../../src/h5p/permissions/ContentAccessRepository.js';
import { CONTENT_LIMITS } from '../../src/h5p/semantics/contentBudget.js';
import { ContentDuplicator } from '../../src/learningDesign/collaboration/ContentDuplicator.js';
import { buildH5pPackage, removeBuiltPackages } from '../support/h5pPackageBuilder.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { requestAs } from '../support/requestAs.js';
import { describeWithServices } from '../support/services.js';
import { MULTI_CHOICE } from '../support/tenTypeLibraries.js';

const { textLength, openTags } = CONTENT_LIMITS;
const LIBRARY = 'H5P.MultiChoice 1.16';
const metadata = { title: 'Celler', license: 'U' };
const TOO_LONG = 'a'.repeat(textLength + 1);
const TOO_NESTED = `${'<span>'.repeat(openTags + 1)}tekst`;
const REFUSED = { errorCode: 'hvl:content-too-large', httpStatusCode: 400 };

describeWithServices('[SEC-005] the limits for one activity at every door', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  const count = () => tb.db.h5PContent.count();
  const body = (params: object) => ({ library: LIBRARY, params: { params, metadata } });
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
  }, 60_000);
  afterAll(async () => {
    removeBuiltPackages();
    await tb.close();
  });

  it('[SEC-005] a new activity past a limit is refused with a message that says which, and nothing is stored', async () => {
    // Arrange
    const before = await count();
    const post = (params: object) => requestAs(tb.app, author, 'post', '/h5p/content').send(body(params));
    // Act
    const long = await post({ question: TOO_LONG });
    const nested = await post({ question: 'Kva?', answers: ['Ja', TOO_NESTED] });
    const many = await post({
      question: 'Kva?',
      answers: Array.from({ length: CONTENT_LIMITS.values }, () => 'a'),
    });
    // Assert
    expect([long.body, nested.body, many.body]).toMatchObject([REFUSED, REFUSED, REFUSED]);
    expect(long.body.message).toBe(
      'Ein tekst i aktiviteten er for lang til å lagrast. Del teksten i fleire delar.',
    );
    expect(nested.body.message).toContain('for mange lag med formatering');
    expect(many.body.message).toContain('Aktiviteten er for stor');
    expect(await count()).toBe(before);
  });

  it('[SEC-005] an edit past a limit, in the parameters or in the metadata, leaves the stored activity as it was', async () => {
    // Arrange
    const id = await tb.activity(author);
    const stored = () => tb.db.h5PContent.findUniqueOrThrow({ where: { id } });
    const before = await stored();
    const put = (params: object, meta: object) =>
      requestAs(tb.app, author, 'put', `/h5p/content/${id}`).send({
        library: LIBRARY,
        params: { params, metadata: meta },
      });
    // Act
    const inParams = await put({ question: TOO_NESTED }, metadata);
    const inMetadata = await put({ question: 'Kva?' }, { ...metadata, title: TOO_LONG });
    // Assert
    expect([inParams.body, inMetadata.body]).toMatchObject([REFUSED, REFUSED]);
    expect(await stored()).toEqual(before);
  });

  it('[SEC-005] «Lagre som ny versjon» past a limit is refused and makes no copy', async () => {
    // Arrange
    const id = await tb.activity(author);
    const access = new PrismaContentAccessRepository(tb.db);
    const duplicator = new ContentDuplicator({ db: tb.db, editor: tb.runtime.editor, access });
    const before = await count();
    // Act
    const copying = duplicator.saveAsCopy(
      id,
      { question: TOO_LONG },
      metadata as never,
      author.actor,
      LIBRARY,
    );
    // Assert
    await expect(copying).rejects.toMatchObject({ errorId: 'hvl:content-too-large', httpStatusCode: 400 });
    expect(await count()).toBe(before);
  });

  it('[SEC-005] a package whose content is past a limit is refused on import', async () => {
    // Arrange
    const pkg = await buildH5pPackage({
      main: MULTI_CHOICE,
      params: { question: 'Kva?', answers: [TOO_LONG] },
    });
    const before = await count();
    // Act
    const res = await requestAs(tb.app, author, 'post', '/h5p/ajax?action=library-upload').attach('h5p', pkg);
    // Assert
    expect(res.body).toMatchObject(REFUSED);
    expect(await count()).toBe(before);
  });

  it('[SEC-005] pasted content past a limit is refused before it is cleaned; content inside the limits is answered', async () => {
    // Arrange: what the editor sends when an author pastes
    const paste = (params: object) =>
      requestAs(tb.app, author, 'post', '/h5p/ajax?action=filter')
        .type('form')
        .send({ libraryParameters: JSON.stringify({ library: LIBRARY, params, metadata }) });
    // Act
    const results = [await paste({ question: TOO_NESTED }), await paste({ question: TOO_LONG })];
    const inside = await paste({ question: '<p>Kva er ei celle?</p>' });
    // Assert
    expect(results.map((res) => res.body)).toMatchObject([REFUSED, REFUSED]);
    expect(inside.status).toBe(200);
  });

  it('[SEC-005] a stored activity past a limit does not open for editing', async () => {
    // Arrange: a row as only something other than a save could have written it
    const id = await tb.activity(author);
    await tb.db.h5PContent.update({ where: { id }, data: { params: { question: TOO_LONG } } });
    // Act
    const res = await requestAs(tb.app, author, 'get', `/h5p/params/${id}`);
    // Assert
    expect(res.body).toMatchObject(REFUSED);
  });

  it('[SEC-005] a save request over 6 MB is refused by its size', async () => {
    // Arrange
    const before = await count();
    const filler = 'a'.repeat(6 * 1024 * 1024);
    // Act
    const res = await requestAs(tb.app, author, 'post', '/h5p/content').send({
      ...body({ question: 'Kva?' }),
      filler,
    });
    // Assert
    expect(res.status).toBe(413);
    expect(await count()).toBe(before);
  });

  it('[SEC-005] the largest content inside the limits is saved, in good time', async () => {
    // Arrange: nineteen of the longest texts, each with as many tags open throughout as the limit allows
    const pair = '</span><span>';
    const head = '<span>'.repeat(openTags);
    const dense = head + pair.repeat(Math.floor((textLength - head.length) / pair.length));
    const params = { question: 'Kva?', answers: Array.from({ length: 19 }, () => dense) };
    // Act
    const started = performance.now();
    const res = await requestAs(tb.app, author, 'post', '/h5p/content').send(body(params));
    const elapsed = performance.now() - started;
    // Assert
    expect(res.status).toBe(201);
    expect(elapsed).toBeLessThan(10_000);
  }, 30_000);
});
