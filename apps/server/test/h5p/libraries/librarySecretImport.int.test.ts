/**
 * Integration tests for the build-secret scan on an administrator's package import over HTTP
 * (`ajax?action=library-upload`): a package whose library files hold a build machine's secrets is refused with 400
 * and `upload.package.librarySecrets` before any audit row or install; content is not scanned, though the same text
 * in a library file is refused; an author's import, which never installs code, is not scanned either (D-110
 * amendment of 2026-11-06). Every secret is made up.
 *
 * Spec: H5P-011, SEC-003
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildSecretsIn } from '../../../src/h5p/libraries/libraryBuildSecrets.js';
import { sha256File } from '../../../src/h5p/libraries/sha256Sums.js';
import { t } from '../../../src/i18n/translate.js';
import { buildH5pPackage, removeBuiltPackages } from '../../support/h5pPackageBuilder.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { MULTI_CHOICE } from '../../support/tenTypeLibraries.js';

const VALUE = 'doNotPrintMe-x3';
const PARAMS = { question: 'Importert?', answers: ['Ja'] };
const DUMP = `var e={PATH:"/usr/bin",HOME:"/h",npm_package_name:"x",GhToken:"${VALUE}"};`;

describeWithServices('the build-secret scan on the package import', () => {
  let tb: HttpTestbed;
  let admin: TestActor;
  let author: TestActor;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    admin = await tb.actor('admin');
    author = await tb.actor('author');
  }, 60_000);
  afterAll(async () => {
    removeBuiltPackages();
    await tb.close();
  });

  const importAs = (who: TestActor, path: string) =>
    requestAs(tb.app, who, 'post', '/h5p/ajax?action=library-upload').attach('h5p', path);
  const installedPatches = async () =>
    ((await tb.runtime.editor.libraryManager.listInstalledLibraries())['H5P.MultiChoice'] ?? []).map(
      (lib) => lib.patchVersion,
    );

  it('[H5P-011] an admin import whose library build holds secrets is refused with 400 before any install', async () => {
    // Arrange: a newer patch, which the import would install, with a leaky dependency.
    const leaky = { machineName: 'H5P.RecorderProbe', files: { 'dist/recorder.js': DUMP } };
    const path = await buildH5pPackage({
      main: { ...MULTI_CHOICE, patchVersion: 11 },
      libraries: [leaky],
      params: PARAMS,
    });
    // Act
    const res = await importAs(admin, path);
    // Assert: refused with the library folder named, in Nynorsk by default, and nothing installed or recorded.
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body).toMatchObject({
      errorCode: 'upload.package.librarySecrets',
      message: t('upload.package.librarySecrets', { libraries: 'H5P.RecorderProbe-1.0' }, 'nn'),
    });
    expect(JSON.stringify(res.body)).not.toContain(VALUE);
    expect(await installedPatches()).not.toContain(11);
    const libraries = await tb.runtime.editor.libraryManager.listInstalledLibraries();
    expect(libraries['H5P.RecorderProbe']).toBeUndefined();
    expect(await tb.db.libraryAuditEvent.count({ where: { sha256: await sha256File(path) } })).toBe(0);
  });

  it('[H5P-011] an admin import whose content quotes a key is accepted; the same text in a library file is not', async () => {
    // Arrange: a programming lesson, under newer patches so each import would install a library.
    const lesson = { question: 'Sjå på koden: {GH_TOKEN:"abc"}', answers: ['Han loggar inn'] };
    expect(buildSecretsIn(JSON.stringify(lesson)), 'the rules flag the lesson text').toEqual(['GH_TOKEN']);
    const asContent = await buildH5pPackage({ main: { ...MULTI_CHOICE, patchVersion: 12 }, params: lesson });
    const lessonFile = { 'lesson.json': JSON.stringify(lesson) };
    const asLibrary = await buildH5pPackage({
      main: { ...MULTI_CHOICE, patchVersion: 13, files: lessonFile },
      params: PARAMS,
    });
    // Act
    const accepted = await importAs(admin, asContent);
    const refused = await importAs(admin, asLibrary);
    // Assert
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    expect(refused.status, JSON.stringify(refused.body)).toBe(400);
    expect(refused.body).toMatchObject({ errorCode: 'upload.package.librarySecrets' });
    expect(await installedPatches()).toContain(12);
    expect(await installedPatches()).not.toContain(13);
  });

  it('[SEC-003] an author’s import is not scanned, since it never installs code: the installed check refuses it', async () => {
    // Arrange: the same leaky dependency in an author's package.
    const leaky = { machineName: 'H5P.RecorderProbe', files: { 'dist/recorder.js': DUMP } };
    const path = await buildH5pPackage({ main: MULTI_CHOICE, libraries: [leaky], params: PARAMS });
    // Act
    const res = await importAs(author, path);
    // Assert: the author's rule (SEC-003), not the scan, answers.
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ errorCode: 'hvl:package-libraries-not-installed' });
  });
});
