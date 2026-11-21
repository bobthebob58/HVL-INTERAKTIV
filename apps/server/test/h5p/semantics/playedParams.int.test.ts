/**
 * Integration tests of the player page with the real content types (D-124): a row written straight to the database
 * with keys its semantics do not name and a value of the wrong type, as a row older than D-123 could hold them,
 * reaches the page fitted, while the row itself stays as it is; and an activity that holds a type no longer
 * accepted as sub-content still plays.
 *
 * Spec: SEC-008, H5P-004, H5P-002
 */
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { UNDECLARED_KEY, withUndeclaredKeys } from '../../support/undeclaredKeys.js';

type Params = Record<string, unknown>;

describeWithServices('[SEC-008] the player page of a row the save rule never saw', () => {
  describeWithRealPackages('[SEC-008] real content types', () => {
    let tb: HttpTestbed;
    let author: TestActor;
    let learner: TestActor;
    const importExample = (type: string) =>
      tb.importPackage(author, join(REAL_PACKAGES_DIR, `${type}.h5p`), { published: true });
    const stored = async (id: string) =>
      (await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).params as Params;
    const store = (id: string, params: Params) =>
      tb.db.h5PContent.update({ where: { id }, data: { params: params as never } });
    const play = (id: string) => requestAs(tb.app, learner, 'get', `/h5p/play/${id}`);

    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      learner = await tb.actor('learner');
    }, 240_000);
    afterAll(() => tb.close());

    it.each(['H5P.Blanks', 'H5P.QuestionSet', 'H5P.InteractiveVideo'])(
      '[SEC-008] %s: the page carries none of the keys its semantics do not name, and the row is not rewritten',
      async (type) => {
        // Arrange: the example, with one more key in every object, written to the row directly
        const id = await importExample(type);
        const before = withUndeclaredKeys(await stored(id));
        await store(id, before);
        // Act
        const page = await play(id);
        // Assert
        expect(page.status).toBe(200);
        expect(page.text).toContain(`cid-${id}`);
        expect(page.text).not.toContain(UNDECLARED_KEY);
        expect(page.text).not.toContain('onerror');
        expect(await stored(id)).toEqual(before);
      },
    );

    it('[SEC-008] a value of another type than its field’s does not reach the page', async () => {
      // Arrange: Blanks' retry switch as text, as no editor writes it
      const id = await importExample('H5P.Blanks');
      const params = await stored(id);
      const behaviour = { ...(params.behaviour as Params), enableRetry: 'hvl-not-a-boolean' };
      await store(id, { ...params, behaviour });
      // Act
      const page = await play(id);
      // Assert
      expect(page.status).toBe(200);
      expect(page.text).not.toContain('hvl-not-a-boolean');
    });

    it('[H5P-002] an activity that holds a type no longer accepted as sub-content still plays', async () => {
      // Arrange: a Column with an audio recorder, as it could be saved before D-123
      const id = await importExample('H5P.Column');
      const params = await stored(id);
      const recorder = {
        content: {
          library: 'H5P.AudioRecorder 1.0',
          params: {},
          subContentId: '5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
        },
        useSeparator: 'auto',
      };
      await store(id, { ...params, content: [...(params.content as unknown[]), recorder] });
      // Act
      const page = await play(id);
      // Assert
      expect(page.status).toBe(200);
      expect(page.text).toContain('H5P.AudioRecorder 1.0');
    });
  });
});
