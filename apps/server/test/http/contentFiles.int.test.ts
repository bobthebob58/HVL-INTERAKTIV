/**
 * Integration tests that the app origin serves no uploaded file to a signed-in person: the two routes that once did
 * (`/h5p/content/<id>/<file>` and `/h5p/temp-files/<file>`) answer as any path that is no route, to the file's owner
 * too; a saved file and a fresh upload are read through their signed addresses only, with the user-file headers
 * and byte ranges, where an unsatisfiable or multiple range sends the whole file (D-153).
 *
 * Spec: SEC-004, H5P-004, H5P-006
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import * as uploads from '../support/uploadFixtures.js';
import { requestAs } from '../support/requestAs.js';

const { PNG_1X1, rawBody, readUpload, uploadEditorFile } = uploads;

describeWithServices('H5P content files', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let contentId: string;
  let image: string;
  let pdf: string;
  let fresh: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    const upload = async (name: string, bytes: Buffer, field?: object) =>
      ((await uploadEditorFile(tb.app, author, name, bytes, field)).body as { path: string }).path;
    const params = {
      question: 'Kva?',
      answers: ['Ja'],
      media: { path: await upload('bilde.png', PNG_1X1), mime: 'image/png', width: 1, height: 1 },
      attachment: {
        path: await upload('notat.pdf', uploads.MINIMAL_PDF, uploads.FILE_FIELD),
        mime: 'application/pdf',
      },
    };
    const res = await requestAs(tb.app, author, 'post', '/h5p/content').send({
      library: 'H5P.MultiChoice 1.16',
      params: { params, metadata: { title: 'Filer', license: 'U' } },
    });
    contentId = (res.body as { contentId: string }).contentId;
    const stored = (await requestAs(tb.app, author, 'get', `/h5p/params/${contentId}`)).body as {
      params: { params: { media: { path: string }; attachment: { path: string } } };
    };
    image = stored.params.params.media.path;
    pdf = stored.params.params.attachment.path;
    fresh = await upload('fersk.png', PNG_1X1);
  }, 60_000);
  afterAll(() => tb.close());

  /** A saved file through the editor's signed address, as the editor page asks for it. */
  const saved = (file: string) => {
    const grant = tb.runtime.editorFileGrants.issueGrant(contentId, new Date());
    return request(tb.app).get(`/h5p/editor-files/${grant}/${contentId}/${file}`).buffer(true).parse(rawBody);
  };

  it('[SEC-004] the two cookie routes for files are gone: the owner gets 404 for a saved file and for a fresh upload', async () => {
    // Arrange
    const noRoute = await requestAs(tb.app, author, 'get', '/h5p/no-such-route');
    const paths = [`/h5p/content/${contentId}/${image}`, `/h5p/temp-files/${fresh.replace(/#tmp$/, '')}`];
    // Act
    const asOwner = await Promise.all(paths.map((path) => requestAs(tb.app, author, 'get', path)));
    const asNobody = await Promise.all(paths.map((path) => request(tb.app).get(path)));
    // Assert: the answer of a path that is no route, and never the file
    expect(image).toMatch(/^images\/.+\.png$/);
    for (const res of asOwner) {
      expect([res.status, res.body]).toEqual([404, noRoute.body]);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
    }
    for (const res of asNobody) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
    }
  });

  it('[SEC-004] the same files are read through their signed addresses, with nosniff and the sandbox policy', async () => {
    // Act
    const answers = [await saved(image), await readUpload(tb, author, fresh)];
    // Assert
    for (const res of answers) {
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toMatch(/^sandbox/);
      expect(res.headers['content-disposition'] ?? 'inline').toMatch(/^inline/);
      expect(Buffer.compare(res.body as Buffer, PNG_1X1)).toBe(0);
    }
  });

  it('[SEC-004] a document is always a download', async () => {
    const res = await saved(pdf);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment/);
  });

  it('[H5P-004] a byte range gives 206 with Content-Range and the file’s type, not its name', async () => {
    const res = await saved(image).set('Range', 'bytes=0-3');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 0-3/${PNG_1X1.length}`);
    expect(res.headers['content-length']).toBe('4');
    expect(res.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(res.body as Buffer, PNG_1X1.subarray(0, 4))).toBe(0);
  });

  it('[H5P-004] an unsatisfiable or multiple range sends the whole file', async () => {
    for (const range of ['bytes=9999-', 'bytes=0-1,3-4', 'items=0-1']) {
      const res = await saved(image).set('Range', range);
      expect(res.status, range).toBe(200);
      expect(res.headers['content-length']).toBe(String(PNG_1X1.length));
    }
  });

  it('[H5P-004] a missing file is 404, and a traversal path never leaves the activity', async () => {
    expect((await saved('images/missing.png')).status).toBe(404);
    const res = await saved('..%2F..%2Fetc%2Fpasswd');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
