/**
 * Integration tests for creating an activity from a pattern through the whole app on the real content types (D-078):
 * the fixture pattern folder, added with no code change, is created in Nynorsk, Bokmål and English with its metadata,
 * its language and fresh `subContentId`s, and validates with V-PLACEHOLDER errors only (D-084, D-085, D-086).
 *
 * Spec: PROD-001, PED-011, PED-010
 */
import { patternActivityResponseSchema } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import {
  openPatternCreationBench,
  storedFindings,
  type PatternCreationBench,
} from './patternCreationBench.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Every `subContentId` in a stored activity's parameters. */
const subContentIds = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(subContentIds);
  if (value === null || typeof value !== 'object') return [];
  const own = (value as { subContentId?: unknown }).subContentId;
  return [...(typeof own === 'string' ? [own] : []), ...Object.values(value).flatMap(subContentIds)];
};

describeWithServices('creating an activity from a pattern', () => {
  describeWithRealPackages('[PROD-001] the fixture pattern on the real content types', () => {
    let bench: PatternCreationBench;
    const created: Record<string, string> = {};
    beforeAll(async () => {
      bench = await openPatternCreationBench();
      for (const language of ['nn', 'nb', 'en'])
        created[language] = (
          await bench.create('fixture-check', {
            language,
            contentType: 'H5P.QuestionSet',
            courseCode: ' syk 110 ',
          })
        ).body.contentId as string;
    }, 240_000);
    afterAll(() => bench?.close(), 60_000);
    const stored = (id: string) => bench.tb.runtime.editor.getContent(id, bench.author);

    it('[PED-011] creates the fixture pattern added as a folder, in nn, nb and en, each as a private draft of the author', async () => {
      // Act
      const rows = await bench.tb.db.h5PContent.findMany({
        where: { id: { in: Object.values(created) } },
        select: { ownerUserId: true, status: true, visibility: true, mainLibrary: true },
      });
      // Assert
      const answers = Object.values(created).map((contentId) =>
        patternActivityResponseSchema.safeParse({ contentId }),
      );
      expect(answers.every((answer) => answer.success)).toBe(true);
      expect(rows).toEqual(
        Object.values(created).map(() => ({
          ownerUserId: bench.authorId,
          status: 'draft',
          visibility: 'private',
          mainLibrary: 'H5P.QuestionSet',
        })),
      );
    });

    it("[PROD-001] stores the language's texts, title, licence, defaultLanguage and language", async () => {
      // Act
      const contents = await Promise.all(
        ['nn', 'nb', 'en'].map(async (l) => [l, await stored(created[l] ?? '')] as const),
      );
      // Assert
      const questions = { nn: 'bruke omgrepet', nb: 'bruke begrepet', en: 'use the concept' };
      const titles = { nn: '⟦Tittel på sjekken⟧', nb: '⟦Tittel på sjekken⟧', en: '⟦Title of the check⟧' };
      for (const [language, { h5p, params }] of contents) {
        expect([h5p.defaultLanguage, h5p.language, h5p.license, h5p.title]).toEqual([
          language,
          language,
          'U',
          titles[language as keyof typeof titles],
        ]);
        expect(JSON.stringify(params.params)).toContain(questions[language as keyof typeof questions]);
      }
    });

    it('[PROD-001] writes the learning-design metadata: first phase, pattern, normalised course code, student minutes', async () => {
      // Act
      const rows = await bench.tb.db.learningDesignMetadata.findMany({
        where: { contentId: { in: Object.values(created) } },
        select: { phase: true, patternId: true, courseCode: true, estimatedStudentMinutes: true },
      });
      // Assert
      expect(rows).toEqual(
        Object.values(created).map(() => ({
          phase: 'forarbeid',
          patternId: 'fixture-check',
          courseCode: 'SYK110',
          estimatedStudentMinutes: 10,
        })),
      );
    });

    it('[PED-010] gives every sub-content a fresh subContentId, unique across the activities', async () => {
      // Act
      const ids = (await Promise.all(Object.values(created).map(stored))).flatMap(({ params }) =>
        subContentIds(params.params),
      );
      // Assert
      expect(ids).toHaveLength(9);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => UUID.test(id))).toBe(true);
    });

    it('[PROD-001] validates with no error but V-PLACEHOLDER, which flags the guidance', async () => {
      // Act
      const findings = await Promise.all(Object.values(created).map((id) => storedFindings(bench, id)));
      // Assert
      for (const list of findings) {
        const errors = list.filter((f) => f.severity === 'error');
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.filter((f) => f.ruleId !== 'V-PLACEHOLDER')).toEqual([]);
        expect(errors.map((f) => f.path)).toContain('metadata.title');
      }
    });

    it("[PROD-001] creates the pattern's other content type in the phase the author chose, with V-PLACEHOLDER errors only", async () => {
      // Act
      const res = await bench.create('fixture-check', {
        language: 'nn',
        contentType: 'H5P.Blanks',
        phase: 'etterarbeid',
      });
      // Assert
      expect(res.status).toBe(201);
      const { h5p } = await stored(res.body.contentId as string);
      const design = await bench.tb.db.learningDesignMetadata.findUnique({
        where: { contentId: res.body.contentId },
      });
      expect([h5p.mainLibrary, design?.phase, design?.courseCode]).toEqual([
        'H5P.Blanks',
        'etterarbeid',
        null,
      ]);
      const findings = await storedFindings(bench, res.body.contentId as string);
      const errors = findings.filter((f) => f.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.filter((f) => f.ruleId !== 'V-PLACEHOLDER')).toEqual([]);
      expect(findings.filter((f) => f.ruleId === 'PED-H07')).toEqual([]);
    });

    it('[PROD-001] refuses a choice the pattern does not offer with 400, and creates nothing', async () => {
      // Arrange
      const before = await bench.tb.db.h5PContent.count({ where: { ownerUserId: bench.authorId } });
      // Act
      const noType = await bench.create('fixture-check', { language: 'nn' });
      const wrongPhase = await bench.create('fixture-check', {
        language: 'nn',
        contentType: 'H5P.Blanks',
        phase: 'underveis',
      });
      const badBody = await bench.create('fixture-check', { language: 'se' });
      // Assert
      expect([noType.status, noType.body.errorCode]).toEqual([400, 'hvl:pattern-choice-invalid']);
      expect([wrongPhase.status, wrongPhase.body.errorCode]).toEqual([400, 'hvl:pattern-choice-invalid']);
      expect([badBody.status, badBody.body.errorCode]).toEqual([400, 'error.badRequest']);
      expect(await bench.tb.db.h5PContent.count({ where: { ownerUserId: bench.authorId } })).toBe(before);
    });
  });
});
