/**
 * Integration tests for serving an activity's files: D-045 headers, byte ranges with the file's own type, and
 * no access to files of activities a person may not see.
 *
 * Spec: SEC-004, H5P-004, H5P-006
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import { FILE_FIELD, MINIMAL_PDF, PNG_1X1, rawBody, uploadEditorFile } from '../support/uploadFixtures.js';

describeWithServices('H5P content files', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let contentId: string;
  let image: string;
  let pdf: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    const png = (await uploadEditorFile(tb.app, author, 'bilde.png', PNG_1X1)).body as { path: string };
    const doc = (await uploadEditorFile(tb.app, author, 'notat.pdf', MINIMAL_PDF, FILE_FIELD)).body as {
      path: string;
    };
    const params = {
      question: 'Kva?',
      answers: ['Ja'],
      media: { path: png.path, mime: 'image/png', width: 1, height: 1 },
      attachment: { path: doc.path, mime: 'application/pdf' },
    };
    const res = await request(tb.app)
      .post('/h5p/content')
      .set(...author.header)
      .send({
        library: 'H5P.MultiChoice 1.16',
        params: { params, metadata: { title: 'Filer', license: 'U' } },
      });
    contentId = (res.body as { contentId: string }).contentId;
    const stored = (
      await request(tb.app)
        .get(`/h5p/params/${contentId}`)
        .set(...author.header)
    ).body as {
      params: { params: { media: { path: string }; attachment: { path: string } } };
    };
    image = stored.params.params.media.path;
    pdf = stored.params.params.attachment.path;
  }, 60_000);
  afterAll(() => tb.close());

  const get = (who: TestActor, file: string) =>
    request(tb.app)
      .get(`/h5p/content/${contentId}/${file}`)
      .set(...who.header)
      .buffer(true)
      .parse(rawBody);

  it('[SEC-004] an image is served inline with its own type, nosniff and the sandbox CSP', async () => {
    expect(image).toMatch(/^images\/.+\.png$/);
    const res = await get(author, image);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/^sandbox/);
    expect(res.headers['content-disposition'] ?? 'inline').toMatch(/^inline/);
    expect(Buffer.compare(res.body as Buffer, PNG_1X1)).toBe(0);
  });

  it('[SEC-004] a document is always a download', async () => {
    const res = await get(author, pdf);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment/);
  });

  it('[H5P-004] a byte range gives 206 with Content-Range and the file’s type, not its name', async () => {
    const res = await get(author, image).set('Range', 'bytes=0-3');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 0-3/${PNG_1X1.length}`);
    expect(res.headers['content-length']).toBe('4');
    expect(res.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(res.body as Buffer, PNG_1X1.subarray(0, 4))).toBe(0);
  });

  it('[H5P-004] an unsatisfiable or multiple range sends the whole file', async () => {
    for (const range of ['bytes=9999-', 'bytes=0-1,3-4', 'items=0-1']) {
      const res = await get(author, image).set('Range', range);
      expect(res.status, range).toBe(200);
      expect(res.headers['content-length']).toBe(String(PNG_1X1.length));
    }
  });

  it('[H5P-006] files of a draft are not served to learners or colleagues', async () => {
    for (const who of [await tb.actor('learner'), await tb.actor('author')]) {
      const res = await get(who, image);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
    }
  });

  it('[H5P-004] a missing file is 404, and a traversal path never leaves the activity', async () => {
    expect((await get(author, 'images/missing.png')).status).toBe(404);
    const res = await request(tb.app)
      .get(`/h5p/content/${contentId}/..%2F..%2Fetc%2Fpasswd`)
      .set(...author.header);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
