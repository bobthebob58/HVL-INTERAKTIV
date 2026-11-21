/**
 * Integration tests of the save rule of D-123 with the real content types (D-078): the example activity of each of
 * the ten types is content the rule leaves alone (but for one key BranchingScenario's editor writes and its player
 * sets itself), a save that carries keys its semantics do not name stores none of them, as a new activity, as
 * an edit and as a copy, and a list longer than its semantics allow is stored with the most they allow (D-126).
 *
 * Spec: SEC-008, H5P-002
 */
import { join } from 'node:path';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { HVL_TOP10_CONTENT_TYPES } from '../../../src/h5p/HvlTop10ContentTypeFilter.js';
import { PrismaContentAccessRepository } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { ContentDuplicator } from '../../../src/learningDesign/collaboration/ContentDuplicator.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { UNDECLARED_KEY, withUndeclaredKeys } from '../../support/undeclaredKeys.js';

type Params = Record<string, unknown>;
/** Every key of the parameters with its place, e.g. `$.questions.0.params.question`. */
const keyPaths = (node: unknown, path = '$'): string[] =>
  typeof node !== 'object' || node === null
    ? []
    : Object.entries(node).flatMap(([key, value]) => [
        `${path}.${key}`,
        ...keyPaths(value, `${path}.${key}`),
      ]);
describeWithServices('[SEC-008] the save rule with the real content types', () => {
  describeWithRealPackages('[SEC-008] real content types', () => {
    let tb: HttpTestbed;
    let app: Express;
    let author: TestActor;
    let duplicator: ContentDuplicator;
    /** The example activity of each type, as imported: its ID, its library and its stored parameters. */
    const examples = new Map<string, { id: string; library: string; params: Params }>();
    const stored = async (id: string) =>
      (await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).params as Params;
    // WHY: the editor sends these three; the save fills in the rest of the metadata from the library.
    const metadata = { title: 'Eksempel', license: 'U', defaultLanguage: 'nn' } as IContentMetadata;

    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      const access = new PrismaContentAccessRepository(tb.db);
      duplicator = new ContentDuplicator({ db: tb.db, editor: tb.runtime.editor, access });
      app = tb.appWith({});
      const installed = await tb.runtime.editor.libraryManager.listInstalledLibraries();
      for (const type of HVL_TOP10_CONTENT_TYPES) {
        const id = await tb.importPackage(author, join(REAL_PACKAGES_DIR, `${type}.h5p`));
        const { majorVersion, minorVersion } = installed[type]?.at(-1) ?? {
          majorVersion: 0,
          minorVersion: 0,
        };
        const library = `${type} ${String(majorVersion)}.${String(minorVersion)}`;
        examples.set(type, { id, library, params: await stored(id) });
      }
    }, 240_000);
    afterAll(() => tb.close());

    it.each(HVL_TOP10_CONTENT_TYPES)(
      '[SEC-008] the example activity of %s holds nothing the rule removes or changes',
      async (type) => {
        // Arrange
        const example = examples.get(type);
        const params = structuredClone(example?.params ?? {});
        const [machineName = '', version = ''] = (example?.library ?? '').split(' ');
        const [majorVersion = 0, minorVersion = 0] = version.split('.').map(Number);
        // Act
        const policy = new SubContentPolicy(tb.runtime.editor.libraryManager);
        await policy.enforce(params, {}, { machineName, majorVersion, minorVersion });
        // Assert: no key is gone. WHY the one exception: BranchingScenario's editor numbers each content node in
        // a `contentId` its semantics do not name; the player numbers the nodes itself when it starts.
        const kept = new Set(keyPaths(params));
        const gone = keyPaths(example?.params).filter((path) => !kept.has(path));
        if (type === 'H5P.BranchingScenario') {
          expect(gone.every((path) => /^\$\.branchingScenario\.content\.\d+\.contentId$/.test(path))).toBe(
            true,
          );
        } else expect(gone).toEqual([]);
      },
    );

    it.each([
      'H5P.Blanks',
      'H5P.MultiChoice',
      'H5P.QuestionSet',
      'H5P.InteractiveVideo',
      'H5P.CoursePresentation',
    ])(
      '[SEC-008] a save of %s that carries undeclared keys stores none of them: new, edited or copied',
      async (type) => {
        // Arrange: the example with a key the semantics do not name in every object
        const example = examples.get(type);
        const id = example?.id ?? '';
        const params = withUndeclaredKeys(example?.params ?? {});
        const body = { library: example?.library, params: { params, metadata } };
        const as = (call: request.Test) => call.set(...author.header).send(body);
        // Act: an edit and a new activity through the routes, and a copy as «Lagre som ny versjon» makes it
        const edited = await as(request(app).put(`/h5p/content/${id}`));
        const created = await as(request(app).post('/h5p/content'));
        const copied = await duplicator.saveAsCopy(id, params, metadata, author.actor, example?.library);
        // Assert
        expect([edited.status, created.status]).toEqual([200, 201]);
        for (const contentId of [id, created.body.contentId as string, copied.contentId]) {
          const after = JSON.stringify(await stored(contentId));
          expect(after).not.toContain(UNDECLARED_KEY);
          expect(after).not.toContain('onerror');
        }
      },
    );

    it('[SEC-008] an Interactive Book with more chapters than its semantics allow is stored with the most they allow', async () => {
      // Arrange: the example's first chapter 51 times; H5P.InteractiveBook's `chapters` has `max: 50`
      const example = examples.get('H5P.InteractiveBook');
      const params = structuredClone(example?.params ?? {}) as { chapters: unknown[] };
      params.chapters = Array.from({ length: 51 }, () => structuredClone(params.chapters[0]));
      const body = { library: example?.library, params: { params, metadata } };
      // Act
      const created = await request(app)
        .post('/h5p/content')
        .set(...author.header)
        .send(body);
      // Assert
      expect(created.status).toBe(201);
      const after = (await stored(created.body.contentId as string)) as { chapters: unknown[] };
      expect(after.chapters).toHaveLength(50);
    });
  });
});
