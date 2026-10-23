/**
 * Integration tests for importing an .h5p package through the editor (`ajax?action=library-upload`): authors
 * import content only, changed library code is refused, zip-slip is refused, admin installs are audited, and
 * no upload folder is left behind.
 *
 * Spec: SEC-003, SEC-005, H5P-002, H5P-011, H5P-006
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../src/i18n/translate.js';
import { buildH5pPackage, removeBuiltPackages } from '../support/h5pPackageBuilder.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import { MULTI_CHOICE, NOT_AUTHORABLE } from '../support/tenTypeLibraries.js';
import { rawBody } from '../support/uploadFixtures.js';

const PARAMS = { question: 'Importert?', answers: ['Ja'] };
const uploadFolders = () => readdirSync(tmpdir()).filter((name) => name.startsWith('hvli-upload-')).length;

describeWithServices('H5P package import over HTTP', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let admin: TestActor;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    admin = await tb.actor('admin');
  }, 60_000);
  afterAll(async () => {
    removeBuiltPackages();
    await tb.close();
  });

  const importAs = (who: TestActor, path: string) =>
    request(tb.app)
      .post('/h5p/ajax?action=library-upload')
      .set(...who.header)
      .attach('h5p', path);

  it('[SEC-003] an author imports the content of a package whose libraries are installed unchanged', async () => {
    const path = await buildH5pPackage({ main: MULTI_CHOICE, params: PARAMS });
    const res = await importAs(author, path);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(JSON.stringify(res.body)).toContain('Importert?');
  });

  it('[SEC-001] an SVG inside an imported package is sanitised like an editor upload', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" onload="alert(1)"><script>alert(2)</script><rect width="4" height="4"/></svg>';
    const params = { ...PARAMS, media: { path: 'images/logo.svg', mime: 'image/svg+xml' } };
    const path = await buildH5pPackage({
      main: MULTI_CHOICE,
      params,
      files: { 'content/images/logo.svg': svg },
    });
    const res = await importAs(author, path);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const imported = JSON.stringify(res.body).match(/images\/[^"#]*\.svg/)?.[0];
    expect(imported).toBeDefined();
    const file = await request(tb.app)
      .get(`/h5p/temp-files/${imported}`)
      .set(...author.header)
      .buffer(true)
      .parse(rawBody);
    expect(file.status).toBe(200);
    const stored = (file.body as Buffer).toString('utf8');
    expect(stored).toContain('<rect');
    expect(stored).not.toMatch(/<script|onload/i);
  });

  it('[SEC-003] modified library code under the same version is ignored; the installed files stay', async () => {
    const evil = { ...MULTI_CHOICE, files: { 'js/main.js': 'alert("replaced")' } };
    const path = await buildH5pPackage({ main: evil, params: PARAMS });
    expect((await importAs(author, path)).status).toBe(200);
    const installed = await tb.runtime.editor.libraryManager.libraryStorage.getFileAsString(
      { machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 16 },
      'js/main.js',
    );
    expect(installed).not.toContain('replaced');
  });

  it('[SEC-003] an author’s package with another patch version of a library is refused', async () => {
    const path = await buildH5pPackage({ main: { ...MULTI_CHOICE, patchVersion: 3 }, params: PARAMS });
    const res = await importAs(author, path);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ errorCode: 'hvl:package-library-version-mismatch' });
  });

  it('[H5P-002] a package whose main library is not one of the ten is refused', async () => {
    const path = await buildH5pPackage({ main: NOT_AUTHORABLE[0]!, params: {} });
    const res = await importAs(admin, path);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      errorCode: 'hvl:content-type-not-allowed',
      message: t('h5p.contentTypeNotAllowed', { library: 'H5P.TrueFalse' }, 'nn'),
    });
  });

  it('[SEC-005] a zip-slip entry is refused before anything is extracted', async () => {
    const path = await buildH5pPackage({ main: MULTI_CHOICE, params: PARAMS, files: { 'xx/evil.js': 'x' } });
    const bytes = readFileSync(path).toString('latin1').split('xx/evil.js').join('../evil.js');
    writeFileSync(path, Buffer.from(bytes, 'latin1'));
    const res = await importAs(author, path);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'upload.archive.unsafePath' });
  });

  it('[SEC-005] a content file reference that leaves the package is refused before Lumi copies anything', async () => {
    const params = { ...PARAMS, media: { path: '../../../../victim.svg', mime: 'image/svg+xml' } };
    const res = await importAs(author, await buildH5pPackage({ main: MULTI_CHOICE, params }));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'upload.archive.unsafePath' });
  });

  it('[H5P-011] an admin import that installs a newer patch is recorded in the library audit', async () => {
    const path = await buildH5pPackage({ main: { ...MULTI_CHOICE, patchVersion: 7 }, params: PARAMS });
    const res = await importAs(admin, path);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const rows = await tb.db.libraryAuditEvent.findMany({ where: { actorUserId: admin.actor.accountId } });
    expect(rows).toEqual([expect.objectContaining({ machineName: 'H5P.MultiChoice', source: 'upload' })]);
    expect(rows[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('[H5P-006] a learner cannot import; a file that is not a package is refused with the reason', async () => {
    const learner = await tb.actor('learner');
    const path = await buildH5pPackage({ main: MULTI_CHOICE, params: PARAMS });
    expect((await importAs(learner, path)).status).toBe(403);
    const notZip = join(tmpdir(), `not-a-package-${Date.now()}.h5p`);
    writeFileSync(notZip, 'plain text');
    const res = await importAs(author, notZip);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ message: t('upload.archive.unreadable', {}, 'nn') });
  });

  it('[SEC-005] no upload folder is left behind after accepted and refused imports', async () => {
    const before = uploadFolders();
    await importAs(author, await buildH5pPackage({ main: MULTI_CHOICE, params: PARAMS }));
    await importAs(
      author,
      await buildH5pPackage({ main: { ...MULTI_CHOICE, patchVersion: 9 }, params: PARAMS }),
    );
    expect(uploadFolders()).toBe(before);
  });
});
