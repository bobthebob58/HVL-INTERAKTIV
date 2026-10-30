/**
 * Integration tests that create every real pattern in `content/laeringsdesign/patterns/` through the whole app on the
 * real content types: each content type in each phase the pattern allows, in Nynorsk, Bokmål and English, as a
 * private draft of the author with its language, its learning-design metadata and fresh, unique `subContentId`s
 * (D-084, D-085). The patterns are ALU's drafts, so no test names a pattern or reads its texts or counts.
 *
 * Spec: PED-010, PROD-001
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { openRealPatternBench, type PatternCreationBench } from './patternCreationBench.js';
import {
  createRealPatterns,
  creationName,
  realPatternChoices,
  realPatternFolders,
  type RealPatternChoice,
  type RealPatternCreation,
} from './realPatterns.js';

const LANGUAGES = ['nn', 'nb', 'en'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Every `subContentId` in stored parameters, and every sub-content node (`{ library, params }`) without one. */
function subContentIdsOf(value: unknown, path = 'params'): { ids: string[]; without: string[] } {
  if (Array.isArray(value))
    return merge(value.map((item: unknown, index) => subContentIdsOf(item, `${path}[${index}]`)));
  if (value === null || typeof value !== 'object') return { ids: [], without: [] };
  const node = value as { library?: unknown; params?: unknown; subContentId?: unknown };
  const own = typeof node.subContentId === 'string' ? [node.subContentId] : [];
  const isNode = typeof node.library === 'string' && node.params !== undefined;
  const children = Object.entries(value).map(([key, child]) => subContentIdsOf(child, `${path}.${key}`));
  const below = merge(children);
  return {
    ids: [...own, ...below.ids],
    without: [...(isNode && own.length === 0 ? [path] : []), ...below.without],
  };
}

const merge = (parts: readonly { ids: string[]; without: string[] }[]) => ({
  ids: parts.flatMap((part) => part.ids),
  without: parts.flatMap((part) => part.without),
});

describeWithServices('creating every real pattern', () => {
  describeWithRealPackages(
    '[PED-010] every pattern of content/laeringsdesign/patterns/ on the real types',
    () => {
      let bench: PatternCreationBench;
      let choices: RealPatternChoice[] = [];
      const created: RealPatternCreation[] = [];
      const stored = (creation: RealPatternCreation) =>
        bench.tb.runtime.editor.getContent(creation.contentId, bench.author);
      beforeAll(async () => {
        bench = await openRealPatternBench();
        choices = realPatternChoices(bench.tb.studio.content.patterns);
        for (const language of LANGUAGES)
          created.push(...(await createRealPatterns(bench, choices, language)));
      }, 300_000);
      afterAll(() => bench?.close(), 60_000);

      it('[PED-010] offers every pattern folder, and each pattern offers at least one content type and phase', () => {
        // Act
        const loaded = bench.tb.studio.content.patterns.patterns.map((pattern) => pattern.id);
        // Assert
        expect(loaded).toEqual(realPatternFolders());
        expect([...new Set(choices.map((choice) => choice.patternId))]).toEqual(loaded);
      });

      it('[PROD-001] creates every content type in every phase of every pattern, in nn, nb and en, as private drafts of the author', async () => {
        // Act
        const failed = created
          .filter((creation) => creation.status !== 201)
          .map(
            (creation) => `${creationName(creation)}: ${creation.status} ${JSON.stringify(creation.body)}`,
          );
        const rows = await bench.tb.db.h5PContent.findMany({
          where: { id: { in: created.map((creation) => creation.contentId) } },
          select: { id: true, ownerUserId: true, status: true, visibility: true, mainLibrary: true },
        });
        // Assert
        expect(failed).toEqual([]);
        const byId = new Map(rows.map(({ id, ...row }) => [id, row]));
        expect(created.map((creation) => [creationName(creation), byId.get(creation.contentId)])).toEqual(
          created.map((creation) => [
            creationName(creation),
            {
              ownerUserId: bench.authorId,
              status: 'draft',
              visibility: 'private',
              mainLibrary: creation.choice.contentType,
            },
          ]),
        );
      });

      it('[PROD-001] stores the chosen language as the language and the default language, with licence U and a title', async () => {
        // Act
        const metadata = await Promise.all(
          created.map(async (creation) => {
            const { h5p } = await stored(creation);
            return [creationName(creation), h5p.language, h5p.defaultLanguage, h5p.license, h5p.title !== ''];
          }),
        );
        // Assert
        expect(metadata).toEqual(
          created.map((creation) => [
            creationName(creation),
            creation.language,
            creation.language,
            'U',
            true,
          ]),
        );
      });

      it("[PED-010] writes each activity's learning-design metadata: the chosen phase, the pattern and its student minutes", async () => {
        // Arrange
        const minutes = new Map(
          bench.tb.studio.content.patterns.patterns.map((pattern) => [pattern.id, pattern.studentMinutes]),
        );
        // Act
        const rows = await bench.tb.db.learningDesignMetadata.findMany({
          where: { contentId: { in: created.map((creation) => creation.contentId) } },
          select: {
            contentId: true,
            phase: true,
            patternId: true,
            courseCode: true,
            estimatedStudentMinutes: true,
          },
        });
        // Assert
        const byId = new Map(rows.map(({ contentId, ...row }) => [contentId, row]));
        expect(created.map((creation) => [creationName(creation), byId.get(creation.contentId)])).toEqual(
          created.map(({ choice, ...creation }) => [
            creationName({ choice, ...creation }),
            {
              phase: choice.phase,
              patternId: choice.patternId,
              courseCode: null,
              estimatedStudentMinutes: minutes.get(choice.patternId),
            },
          ]),
        );
      });

      it('[PED-010] gives every sub-content node a fresh subContentId, unique across all the created activities', async () => {
        // Act
        const found = await Promise.all(
          created.map(async (creation) => ({
            name: creationName(creation),
            ...subContentIdsOf((await stored(creation)).params.params),
          })),
        );
        // Assert
        const ids = found.flatMap(({ ids }) => ids);
        expect(found.filter(({ without }) => without.length > 0)).toEqual([]);
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.filter((id) => !UUID.test(id))).toEqual([]);
        expect(new Set(ids).size).toBe(ids.length);
      });
    },
  );
});
