/**
 * Integration tests for the save gate on a real content type (D-078) with the real validator: an alt text that the
 * editor's sanitising empties is judged empty, and the gate's saved form is what the editor really stores.
 *
 * Spec: PROD-003, UD-021
 */
import { join } from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { loadValidationContext } from '../../src/config/validationContext.js';
import { PublishedSaveGate } from '../../src/content/PublishedSaveGate.js';
import { editorSavedForm, type SavedForm } from '../../src/content/savedForm.js';
import { createContentValidator } from '../../src/validation/validateContent.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

const RAW_TEXT_TAGS = ['style', 'script', 'textarea', 'option'] as const;
const metadata = { title: 'Kart', license: 'U', defaultLanguage: 'nn' };

describeWithServices('[PROD-003] the save gate on a real ImageHotspots activity', () => {
  describeWithRealPackages('[PROD-003] real content types', () => {
    let tb: HttpTestbed;
    let app: Express;
    let author: TestActor;
    let savedForm: SavedForm;
    let library: string;

    const importActivity = (published: boolean) =>
      tb.importPackage(author, join(REAL_PACKAGES_DIR, 'H5P.ImageHotspots.h5p'), { published });
    const stored = (id: string) => tb.db.h5PContent.findUniqueOrThrow({ where: { id } });
    const withAlt = async (id: string, alt: string) => ({
      ...((await stored(id)).params as Record<string, unknown>),
      backgroundImageAltText: alt,
    });
    const save = (id: string, params: object) =>
      request(app)
        .put(`/h5p/content/${id}`)
        .set(...author.header)
        .send({ library, params: { params, metadata } });

    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      const validator = createContentValidator(loadValidationContext({ CAPTIONED_MEDIA_ORIGINS: [] }));
      savedForm = editorSavedForm(tb.runtime.editor.libraryManager);
      const gate = new PublishedSaveGate({ db: tb.db, validator, clock: () => new Date() }, savedForm);
      app = tb.appWith({ saveGate: gate });
      const { majorVersion, minorVersion } = (
        await tb.runtime.editor.libraryManager.listInstalledLibraries('H5P.ImageHotspots')
      )['H5P.ImageHotspots']?.[0] ?? { majorVersion: 0, minorVersion: 0 };
      library = `H5P.ImageHotspots ${String(majorVersion)}.${String(minorVersion)}`;
    }, 180_000);
    afterAll(() => tb.close());

    it.each(RAW_TEXT_TAGS)(
      '[PROD-003] a published activity whose alt text is only a <%s> element is refused, and nothing is saved',
      async (tag) => {
        // Arrange
        const id = await importActivity(true);
        const before = await stored(id);
        // Act
        const res = await save(id, await withAlt(id, `<${tag}>Kart over campus</${tag}>`));
        // Assert
        expect(res.status).toBe(409);
        expect(res.body.errorCode).toBe('hvl:published-save-blocked');
        expect(res.body.findings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              ruleId: 'V-IMG-ALT',
              path: 'backgroundImageAltText',
              acknowledgement: null,
            }),
          ]),
        );
        expect(await stored(id)).toMatchObject({ params: before.params, status: 'published', version: 1 });
      },
      60_000,
    );

    it('[PROD-003] the saved form the gate validates equals what the editor stores for the same save', async () => {
      // Arrange
      const id = await importActivity(false);
      const params = await withAlt(id, '<style>Kart</style> over <b>campus</b>');
      // Act
      const predicted = await savedForm({ mainLibrary: library, params, metadata });
      const res = await save(id, params);
      // Assert
      expect(res.status).toBe(200);
      expect((await stored(id)).params).toEqual(predicted?.params);
      expect(predicted?.params).toMatchObject({ backgroundImageAltText: ' over <b>campus</b>' });
      expect(params.backgroundImageAltText).toBe('<style>Kart</style> over <b>campus</b>');
    }, 60_000);
  });
});
