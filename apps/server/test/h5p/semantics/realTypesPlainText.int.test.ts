/**
 * Integration tests of the text rules of D-140 with the real content types (D-078): the example activity of each of
 * the ten types holds no plain text field the rule changes; a save through the routes stores a button label and a
 * link's title as plain text and the link's address fitted; and a row written straight to the database with
 * markup in those fields reaches the player page without it, while the row stays as it is.
 *
 * Spec: SEC-008, H5P-004
 */
import { join } from 'node:path';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { HVL_TOP10_CONTENT_TYPES } from '../../../src/h5p/HvlTop10ContentTypeFilter.js';
import { isPlainTextField } from '../../../src/h5p/semantics/lumiTextSanitizer.js';
import { walkParams } from '../../../src/h5p/semantics/paramsWalker.js';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';

type Params = Record<string, unknown>;
const LINKED = 'Sjekk <a href="https://example.org/">svaret</a>';
const QUOTED_ADDRESS = 'hvl.no/kurs" style="x';
const metadata = { title: 'Eksempel', license: 'U', defaultLanguage: 'nn' } as IContentMetadata;

describeWithServices('[SEC-008] the text rules with the real content types', () => {
  describeWithRealPackages('[SEC-008] real content types', () => {
    let tb: HttpTestbed;
    let author: TestActor;
    let learner: TestActor;
    const importExample = (type: string) =>
      tb.importPackage(author, join(REAL_PACKAGES_DIR, `${type}.h5p`), { published: true });
    const stored = async (id: string) =>
      (await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).params as Params;
    const libraryOf = async (type: string) => {
      const installed = await tb.runtime.editor.libraryManager.listInstalledLibraries();
      const { majorVersion = 0, minorVersion = 0 } = installed[type]?.at(-1) ?? {};
      return { machineName: type, majorVersion, minorVersion };
    };
    /** Every plain text field's value, by its place. */
    const plainTexts = async (params: Params, type: string) => {
      const found: Record<string, string> = {};
      const manager = tb.runtime.editor.libraryManager;
      await walkParams(
        params,
        await libraryOf(type),
        (library) => manager.getSemantics(library),
        ({ semantics, value, path }) => {
          if (isPlainTextField(semantics) && typeof value === 'string') found[path] = value;
        },
      );
      return found;
    };
    /** A Course Presentation whose first slide has a link element and whose link and label hold markup. */
    const withLink = (example: Params): Params => {
      const params = structuredClone(example) as { presentation: { slides: { elements: unknown[] }[] } };
      params.presentation.slides[0]?.elements.push({
        x: 10,
        y: 10,
        width: 30,
        height: 10,
        buttonLabel: LINKED,
        action: {
          library: 'H5P.Link 1.3',
          params: { title: LINKED, linkWidget: { protocol: 'https://', url: QUOTED_ADDRESS } },
          subContentId: '5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
          metadata: { contentType: 'Link', license: 'U', title: 'Lenke' },
        },
      });
      return params;
    };
    const linkElement = (params: Params) =>
      (params as { presentation: { slides: { elements: Params[] }[] } }).presentation.slides[0]?.elements.at(
        -1,
      ) as { buttonLabel: string; action: { params: { title: string; linkWidget: { url: string } } } };

    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      learner = await tb.actor('learner');
    }, 240_000);
    afterAll(() => tb.close());

    it.each(HVL_TOP10_CONTENT_TYPES)(
      '[SEC-008] the example activity of %s has plain text fields, and the rule changes none of them',
      async (type) => {
        // Arrange
        const example = await stored(await importExample(type));
        const before = await plainTexts(example, type);
        // Act
        const params = structuredClone(example);
        await new SubContentPolicy(tb.runtime.editor.libraryManager).enforce(
          params,
          {},
          await libraryOf(type),
        );
        // Assert
        expect(Object.keys(before).length).toBeGreaterThan(5);
        expect(await plainTexts(params, type)).toEqual(before);
      },
    );

    it('[SEC-008] a save stores a button label and a link title as plain text, and the link address fitted', async () => {
      // Arrange
      const id = await importExample('H5P.CoursePresentation');
      const { majorVersion, minorVersion } = await libraryOf('H5P.CoursePresentation');
      const library = `H5P.CoursePresentation ${String(majorVersion)}.${String(minorVersion)}`;
      const body = { library, params: { params: withLink(await stored(id)), metadata } };
      // Act
      const saved = await request(tb.appWith({}))
        .put(`/h5p/content/${id}`)
        .set(...author.header)
        .send(body);
      // Assert
      expect(saved.status).toBe(200);
      const link = linkElement(await stored(id));
      expect(link.buttonLabel).toBe('Sjekk svaret');
      expect(link.action.params.title).toBe('Sjekk svaret');
      expect(link.action.params.linkWidget.url).toBe('hvl.no/kurs%22%20style=%22x');
    });

    it('[H5P-004] a row stored with markup in those fields reaches the player page without it, and is not rewritten', async () => {
      // Arrange: written to the row directly, as a save before this rule could store it
      const id = await importExample('H5P.CoursePresentation');
      const before = withLink(await stored(id));
      await tb.db.h5PContent.update({ where: { id }, data: { params: before as never } });
      // Act
      const page = await requestAs(tb.app, learner, 'get', `/h5p/play/${id}`);
      // Assert
      expect(page.status).toBe(200);
      expect(page.text).toContain(`cid-${id}`);
      expect(page.text).toContain('Sjekk svaret');
      expect(page.text).not.toContain('example.org');
      expect(page.text).toContain('hvl.no/kurs%22%20style=%22x');
      expect(await stored(id)).toEqual(before);
    });
  });
});
