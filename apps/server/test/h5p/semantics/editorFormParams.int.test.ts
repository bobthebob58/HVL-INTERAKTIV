/**
 * Integration tests of what the editor is handed (D-124). With the real content types: an activity opened for
 * editing arrives without the keys its semantics do not name, with a quote in plain text and in the title written
 * as the editor writes it, and saved back unchanged it is stored with its text as before. With an uploaded package:
 * the content in the answer is cleaned the same way, its title data and that of its pieces is plain text, and a
 * package whose content cannot be read is refused.
 *
 * Spec: SEC-008, SEC-005, H5P-006
 */
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildH5pPackage, removeBuiltPackages } from '../../support/h5pPackageBuilder.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { MULTI_CHOICE, QUESTION_SET } from '../../support/tenTypeLibraries.js';
import { MARKUP, UNDECLARED_KEY, withUndeclaredKeys } from '../../support/undeclaredKeys.js';

type Params = Record<string, unknown>;
const QUOTED = 'Vis "fasit"';
const TITLE = 'Kva er "celle"?';

describeWithServices('[SEC-008] what the editor is handed', () => {
  describeWithRealPackages('[SEC-008] an activity opened for editing, real content types', () => {
    let tb: HttpTestbed;
    let author: TestActor;
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
    }, 240_000);
    afterAll(() => tb.close());

    it('[H5P-006] arrives fitted, with quotes in the editor’s form, and is stored as before when saved back', async () => {
      // Arrange: a Blanks row as an older save could have stored it, with a quote in a label and in the title
      const id = await tb.importPackage(author, join(REAL_PACKAGES_DIR, 'H5P.Blanks.h5p'));
      const row = await tb.db.h5PContent.findUniqueOrThrow({ where: { id } });
      const params = { ...withUndeclaredKeys(row.params as Params), showSolutions: QUOTED };
      const metadata = { ...(row.metadata as Params), title: TITLE };
      await tb.db.h5PContent.update({
        where: { id },
        data: { params: params as never, metadata: metadata as never },
      });
      // Act: open it, and save back what the editor was handed
      const opened = await requestAs(tb.app, author, 'get', `/h5p/params/${id}`);
      const handed = opened.body as { library: string; params: { params: Params; metadata: Params } };
      const saved = await requestAs(tb.app, author, 'put', `/h5p/content/${id}`).send({
        library: handed.library,
        params: handed.params,
      });
      // Assert: what the editor got
      expect(opened.status).toBe(200);
      expect(opened.text).not.toContain(UNDECLARED_KEY);
      expect(handed.params.params.showSolutions).toBe('Vis &quot;fasit&quot;');
      expect(handed.params.metadata.title).toBe('Kva er &quot;celle&quot;?');
      // Assert: what is stored after the save
      const after = await tb.db.h5PContent.findUniqueOrThrow({ where: { id } });
      expect(saved.status).toBe(200);
      expect((after.params as Params).showSolutions).toBe(QUOTED);
      expect((after.metadata as Params).title).toBe(TITLE);
      expect(JSON.stringify(after.params)).not.toContain(UNDECLARED_KEY);
    });
  });

  describe('[SEC-005] an uploaded package', () => {
    let tb: HttpTestbed;
    let author: TestActor;
    const upload = (path: string) =>
      requestAs(tb.app, author, 'post', '/h5p/ajax?action=library-upload').attach('h5p', path);
    beforeAll(async () => {
      tb = await openHttpTestbed();
      author = await tb.actor('author');
    }, 60_000);
    afterAll(async () => {
      removeBuiltPackages();
      await tb.close();
    });

    it('[SEC-005] is answered with its content cleaned: fitted, text as on save, quotes in the editor’s form', async () => {
      // Arrange: content.json as no editor writes it
      const params = {
        question: `Kva er "celle"?${MARKUP}`,
        answers: ['"Ja"', MARKUP],
        [UNDECLARED_KEY]: MARKUP,
        nested: { library: 'school library', [UNDECLARED_KEY]: MARKUP },
      };
      // Act
      const res = await upload(await buildH5pPackage({ main: MULTI_CHOICE, params }));
      // Assert
      expect(res.status).toBe(200);
      expect((res.body as { data: { content: unknown } }).data.content).toEqual({
        question: 'Kva er &quot;celle&quot;?',
        answers: ['&quot;Ja&quot;', ''],
      });
      expect(res.text).not.toContain('onerror');
    });

    it('[SEC-005] is answered with its title data, its pieces’ title data and its settings as plain text', async () => {
      // Arrange: markup wherever a title, a licence note, an author or a setting may stand. WHY: Lumi's package
      // check takes only a plain word as a role in h5p.json; a piece's title data is not checked by it.
      const titleData = (role: string) => ({
        title: `Celler${MARKUP}`,
        license: 'CC BY',
        licenseExtras: `Merknad${MARKUP}`,
        authors: [{ name: `Kari${MARKUP}`, role }],
        authorComments: `Sjå over${MARKUP}`,
      });
      const piece = {
        library: 'H5P.MultiChoice 1.16',
        subContentId: 'a1b2c3d4-0000-4000-8000-000000000001',
        metadata: { ...titleData(`Author${MARKUP}`), contentType: 'Multiple Choice' },
        params: { question: 'Kva?', answers: ['Ja'], media: { path: MARKUP, mime: MARKUP, width: MARKUP } },
      };
      const h5pJson = {
        ...titleData('Author'),
        language: 'nn',
        mainLibrary: QUESTION_SET.machineName,
        embedTypes: ['iframe'],
        preloadedDependencies: [QUESTION_SET, MULTI_CHOICE].map((lib) => ({
          machineName: lib.machineName,
          majorVersion: 1,
          minorVersion: lib.minorVersion ?? 0,
        })),
      };
      // Act
      const res = await upload(
        await buildH5pPackage({
          main: QUESTION_SET,
          libraries: [MULTI_CHOICE],
          params: { questions: [piece] },
          files: { 'h5p.json': JSON.stringify(h5pJson) },
        }),
      );
      // Assert
      const cleaned = {
        title: 'Celler',
        licenseExtras: 'Merknad',
        authors: [{ name: 'Kari', role: 'Author' }],
      };
      const data = (res.body as { data: { h5p: Params; content: { questions: { metadata: Params }[] } } })
        .data;
      expect(res.status).toBe(200);
      expect(data.h5p).toMatchObject(cleaned);
      expect(data.content.questions[0]?.metadata).toMatchObject(cleaned);
      expect(res.text).not.toMatch(/<img|onerror=alert/);
    });

    it('[SEC-005] is refused when its content cannot be read as its semantics describe, and keeps no path to a file it lacks', async () => {
      // Arrange: a list that is no list; and a path, unsafe in an attribute, to a file the package does not carry
      const lookalike = { question: 'Kva?', answers: { 0: MARKUP, length: 1 } };
      const unsafe = { question: 'Kva?', media: { path: 'images/a.png" onerror="x', mime: 'image/png' } };
      // Act
      const refused = await upload(await buildH5pPackage({ main: MULTI_CHOICE, params: lookalike }));
      const emptied = await upload(await buildH5pPackage({ main: MULTI_CHOICE, params: unsafe }));
      // Assert: 400 before the importer reads it; the importer itself empties a path that names no carried file
      expect(refused.status).toBe(400);
      expect(refused.body).toMatchObject({ errorCode: 'hvl:invalid-params' });
      expect(emptied.status).toBe(200);
      expect((emptied.body as { data: { content: unknown } }).data.content).toEqual({
        question: 'Kva?',
        media: { path: '', mime: 'image/png' },
      });
    });
  });
});
