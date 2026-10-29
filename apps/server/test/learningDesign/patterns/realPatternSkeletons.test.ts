/**
 * Unit tests on the parameters every real pattern's skeleton becomes (PROD-009 "Verify: unit tests on skeleton
 * parameters"): each skeleton in `content/laeringsdesign/patterns/` is built as the creation route builds it (tokens,
 * localised semantics defaults, fresh `subContentId`s) on the pinned libraries, in nn, nb and en, without the database
 * or the editor's save. The built parameters keep retry and «Vis svar» on, set no time limit and keep pass marks
 * informative (./realPatternSwitches.ts), and the validator gives no PED-H07 hint and no error but V-PLACEHOLDER.
 * The integration tests (./realPattern*.int.test.ts) check the same on what H5P stores; these run without services.
 * The patterns are ALU's drafts, so no test names one or reads its texts or counts.
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
import { createContentValidator } from '../../../src/validation/validateContent.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { formativeViolations } from './realPatternSwitches.js';

const LANGUAGES = ['nn', 'nb', 'en'] as const;

interface Built {
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
