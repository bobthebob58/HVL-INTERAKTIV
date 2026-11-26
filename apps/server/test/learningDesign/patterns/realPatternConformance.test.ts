/**
 * Unit tests that every real pattern's skeleton is content the save rule of D-123 leaves alone: built as the
 * creation route builds it on the pinned libraries, in nn, nb and en, it holds no key its semantics do not name and
 * no number, boolean, select or file value of another type than its field's. So a pattern loses nothing when it is
 * saved.
 *
 * Spec: SEC-008, PROD-009
 */
import { fsImplementations, LibraryManager, LibraryName } from '@lumieducation/h5p-server';
import { expect, it } from 'vitest';
import { withLanguageFallback } from '../../../src/h5p/storage/LanguageFallbackLibraryStorage.js';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { PINNED_LIBRARIES_DIR } from '../../../src/learningDesign/content/installedLibraries.js';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import { buildPatternActivity } from '../../../src/learningDesign/patterns/patternActivityBuild.js';
import { describeWithRealPackages } from '../../support/realPackages.js';

const LANGUAGES = ['nn', 'nb', 'en'] as const;

describeWithRealPackages('[SEC-008] every real pattern skeleton under the save rule', () => {
  it('[SEC-008] no skeleton holds anything the rule removes or changes, in any language', async () => {
    // Arrange: the editor's own library stack, as ./realPatternSkeletons.test.ts builds on
    const libraries = new LibraryManager(
      withLanguageFallback(new fsImplementations.FileLibraryStorage(PINNED_LIBRARIES_DIR)),
    );
    const policy = new SubContentPolicy(libraries);
    const skeletons = loadStudioContent().patterns.patterns.flatMap((pattern) =>
      pattern.skeletons.flatMap((skeleton) => LANGUAGES.map((language) => ({ pattern, skeleton, language }))),
    );
    // Act
    const changed: string[] = [];
    for (const { pattern, skeleton, language } of skeletons) {
      const activity = await buildPatternActivity(pattern, skeleton, language, libraries);
      const params = structuredClone(activity.params) as Record<string, unknown>;
      const main = LibraryName.fromUberName(activity.library, { useWhitespace: true });
      const count = await policy.enforce(params, {}, main);
      if (count > 0) changed.push(`${pattern.id} ${skeleton.contentType} ${language}: ${String(count)}`);
    }
    // Assert
    expect(skeletons.length).toBeGreaterThan(0);
    expect(changed).toEqual([]);
  });
});
