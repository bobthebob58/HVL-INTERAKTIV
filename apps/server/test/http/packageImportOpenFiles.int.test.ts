/**
 * Integration tests for how a package import reads the package and what it leaves behind: one zip reader only,
 * and after a refusal or a failure no open file and no upload folder, however often it is repeated (D-118).
 *
 * Spec: SEC-005
 */
import { randomBytes } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { damageEntry, declareSize } from '../support/damagedPackage.js';
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
/** Lumi's own zip reader, as its CommonJS modules load it. */
const lumiZipReader = createRequire(createRequire(import.meta.url).resolve('@lumieducation/h5p-server'))(
  'yauzl-promise',
) as { open: (...args: unknown[]) => unknown };

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

  it('[SEC-005] an import reads the package with the reader of the archive check only', async () => {
    // Arrange
    const opened = vi.spyOn(lumiZipReader, 'open');
    const path = await buildH5pPackage({ main: MULTI_CHOICE, params: PARAMS });
    // Act: an author's import (content only) and an administrator's (content and library folders)
    const asAuthor = await importAs(author, path);
    const asAdmin = await importAs(admin, path);
    // Assert
    expect([asAuthor.status, asAdmin.status]).toEqual([200, 200]);
    expect(JSON.stringify(asAuthor.body)).toContain('Importert?');
    expect(opened).not.toHaveBeenCalled();
    opened.mockRestore();
  });

  it.runIf(canListOpenFiles)(
    '[SEC-005] a package with an entry that declares another size than it has is refused and leaves no open file',
    async () => {
      // Arrange
      const files = { 'content/images/large.bin': bulky(512 * 1024) };
      const path = await buildH5pPackage({ main: MULTI_CHOICE, params: PARAMS, files });
      declareSize(path, 'content/images/large.bin', 1000);
      // Act
      const res = await importAs(author, path);
      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ errorCode: 'upload.archive.unreadable' });
      expect(openFilesUnder(UPLOAD)).toEqual([]);
    },
  );

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

  it.runIf(canListOpenFiles)(
    '[SEC-005] a file reference the storage would refuse is refused before the package is unpacked, however often',
    async () => {
      // Arrange: the file is in the package, but its reference has a segment the storage does not accept.
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
      const params = { ...PARAMS, media: { path: './images/drawing.svg', mime: 'image/svg+xml' } };
      const files = { 'content/images/drawing.svg': svg };
      const path = await buildH5pPackage({ main: MULTI_CHOICE, params, files });
      // Act
      const answers = [];
      for (let attempt = 0; attempt < 5; attempt += 1) answers.push(await importAs(author, path));
      // Assert
      for (const res of answers) {
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ errorCode: 'upload.archive.unsafePath' });
      }
      expect(openFilesUnder('drawing.svg')).toEqual([]);
      expect(openFilesUnder(UPLOAD)).toEqual([]);
    },
  );
});
