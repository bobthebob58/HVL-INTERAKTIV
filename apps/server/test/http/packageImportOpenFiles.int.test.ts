/**
 * Integration tests for what a package import leaves behind when it is refused or fails: no open file and no
 * upload folder, however often it is repeated (D-118).
 *
 * Spec: SEC-005
 */
import { randomBytes } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { damageEntry } from '../support/damagedPackage.js';
import { buildH5pPackage, removeBuiltPackages } from '../support/h5pPackageBuilder.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { canListOpenFiles, openFilesUnder } from '../support/openFiles.js';
import { requestAs } from '../support/requestAs.js';
import { describeWithServices } from '../support/services.js';
import { libraryFolder } from '../support/syntheticLibraries.js';
import { MULTI_CHOICE } from '../support/tenTypeLibraries.js';

const PARAMS = { question: 'Importert?', answers: ['Ja'] };
/** Text that deflate cannot shrink much, so the entry's data is far larger than one read of the file. */
const bulky = (bytes: number): string => randomBytes(bytes).toString('base64');
const UPLOAD = 'hvli-upload-';
const uploadFolders = () => readdirSync(tmpdir()).filter((name) => name.startsWith(UPLOAD)).length;

describeWithServices('[SEC-005] what a refused package import leaves behind', () => {
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
    requestAs(tb.app, who, 'post', '/h5p/ajax?action=library-upload').attach('h5p', path);

  it.runIf(canListOpenFiles)(
    '[SEC-005] a package whose content.json cannot be read is refused and leaves no open file',
    async () => {
      // Arrange
      const params = { ...PARAMS, note: bulky(512 * 1024) };
      const path = await buildH5pPackage({ main: MULTI_CHOICE, params });
      await damageEntry(path, 'content/content.json');
      const folders = uploadFolders();
      // Act
      const res = await importAs(author, path);
      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ errorCode: 'upload.package.notH5p' });
      expect(openFilesUnder(UPLOAD)).toEqual([]);
      expect(uploadFolders()).toBe(folders);
    },
  );

  it.runIf(canListOpenFiles)(
    "[SEC-005] an administrator's package with a library file that cannot be read is refused and leaves no open file",
    async () => {
      // Arrange
      const main = { ...MULTI_CHOICE, patchVersion: 31, files: { 'js/large.js': bulky(512 * 1024) } };
      const path = await buildH5pPackage({ main, params: PARAMS });
      await damageEntry(path, `${libraryFolder(main)}/js/large.js`);
      // Act
      const res = await importAs(admin, path);
      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ errorCode: 'upload.archive.unreadable' });
      expect(openFilesUnder(UPLOAD)).toEqual([]);
      expect(await tb.db.libraryAuditEvent.count({ where: { actorUserId: admin.actor.accountId } })).toBe(0);
    },
  );
});
