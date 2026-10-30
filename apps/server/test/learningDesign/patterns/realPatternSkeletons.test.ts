/**
 * Unit tests on the parameters every real pattern's skeleton becomes (PROD-009 "Verify: unit tests on skeleton
 * parameters"): each skeleton in `content/laeringsdesign/patterns/` is built as the creation route builds it (tokens,
 * localised semantics defaults, fresh `subContentId`s) on the pinned libraries, in nn, nb and en, without the database
 * or the editor's save. The built parameters keep retry and «Vis svar» on, set no time limit and keep pass marks
 * informative (./realPatternSwitches.ts), and the validator gives no PED-H07 hint and no error but V-PLACEHOLDER.
 * The integration tests (./realPattern*.int.test.ts) check the same on what H5P stores; these run without services.
 * The patterns are ALU's drafts, so no test reads their texts or counts. One test names two patterns, for a setting
 * that spec 04 §4 and the D-084 amendment decide: `ea-terms`' fill-in task accepts small typos, `uv-column`'s does
 * not, so no number passes with a wrong digit.
 *
 * Spec: PROD-009, PED-010
 */
import { fsImplementations, LibraryManager } from '@lumieducation/h5p-server';
import { expect, it } from 'vitest';
import { loadValidationContext } from '../../../src/config/validationContext.js';
import { withLanguageFallback } from '../../../src/h5p/storage/LanguageFallbackLibraryStorage.js';
import { PINNED_LIBRARIES_DIR } from '../../../src/learningDesign/content/installedLibraries.js';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import {
  buildPatternActivity,
  type PatternActivity,
} from '../../../src/learningDesign/patterns/patternActivityBuild.js';
import { walkContent } from '../../../src/validation/contentWalker.js';
import { fieldAt } from '../../../src/validation/paramReaders.js';
import { createContentValidator } from '../../../src/validation/validateContent.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { formativeViolations } from './realPatternSwitches.js';

const LANGUAGES = ['nn', 'nb', 'en'] as const;

// PEDAGOGY: spec 04 §4 asks `ea-terms` to accept small typos in its terms. «Godta mindre skrivefeil» also accepts
// one wrong or swapped digit in a number (12,5 ← 125, a tenfold dose), so `uv-column`, whose example is a dosage
// calculation, matches exactly (D-084 amendment, 2026-10-29). The other patterns' choice is ALU's.
const TYPO_TOLERANCE: Readonly<Record<string, boolean>> = { 'ea-terms': true, 'uv-column': false };

interface Built {
  readonly patternId: string;
  readonly name: string;
  readonly language: (typeof LANGUAGES)[number];
  readonly activity: PatternActivity;
}

describeWithRealPackages(
  '[PROD-009] the parameters of every real pattern skeleton, built on the pinned libraries',
  () => {
    // WHY: the editor's own library stack (H5pEditorFactory.ts): the files, with the Nynorsk/Bokmål language fallback.
    const libraries = new LibraryManager(
      withLanguageFallback(new fsImplementations.FileLibraryStorage(PINNED_LIBRARIES_DIR)),
    );
    const validate = createContentValidator(loadValidationContext({ CAPTIONED_MEDIA_ORIGINS: [] }));
    const buildAll = (): Promise<Built[]> =>
      Promise.all(
        loadStudioContent().patterns.patterns.flatMap((pattern) =>
          pattern.skeletons.flatMap((skeleton) =>
            LANGUAGES.map(async (language) => ({
              patternId: pattern.id,
              name: `${pattern.id} ${skeleton.contentType} ${language}`,
              language,
              activity: await buildPatternActivity(pattern, skeleton, language, libraries),
            })),
          ),
        ),
      );

    it('[PROD-009] keeps retry and «Vis svar» on, sets no time limit and gates nothing, in every node of every skeleton', async () => {
      // Act
      const built = await buildAll();
      const violations = built.flatMap(({ name, activity }) =>
        formativeViolations(walkContent(activity.library, activity.params)).map(
          (problem) => `${name}: ${problem}`,
        ),
      );
      // Assert
      expect(built.length).toBeGreaterThan(0);
      expect(violations).toEqual([]);
    });

    it("[PED-010] accepts small typos in ea-terms' fill-in task and none in uv-column's, so no number passes with a wrong digit", async () => {
      // Arrange
      const built = (await buildAll()).filter(({ patternId }) => Object.hasOwn(TYPO_TOLERANCE, patternId));
      // Act
      const settings = built.flatMap(({ patternId, name, activity }) =>
        walkContent(activity.library, activity.params)
          .filter((node) => node.machineName === 'H5P.Blanks')
          .map((node) => ({
            patternId,
            name,
            accepted: fieldAt(node.params, 'behaviour', 'acceptSpellingErrors') === true,
          })),
      );
      // Assert
      expect(new Set(settings.map(({ patternId }) => patternId))).toEqual(
        new Set(Object.keys(TYPO_TOLERANCE)),
      );
      expect(settings.filter(({ patternId, accepted }) => accepted !== TYPO_TOLERANCE[patternId])).toEqual(
        [],
      );
    });

    it('[PROD-009] gives no PED-H07 hint and no error but V-PLACEHOLDER on any built skeleton', async () => {
      // Arrange
      const built = await buildAll();
      // Act
      const findings = await Promise.all(
        built.map(async ({ name, language, activity }) => {
          const metadata = { title: activity.title, language, defaultLanguage: language, license: 'U' };
          const found = await validate({
            mainLibrary: activity.library,
            params: activity.params,
            metadata,
            locale: 'nn',
          });
          return found
            .filter((f) => f.ruleId === 'PED-H07' || (f.severity === 'error' && f.ruleId !== 'V-PLACEHOLDER'))
            .map((f) => `${name}: ${f.ruleId} at ${f.path}`);
        }),
      );
      // Assert
      expect(findings.flat()).toEqual([]);
    });
  },
);
