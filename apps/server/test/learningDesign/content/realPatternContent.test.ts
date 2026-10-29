/**
 * Tests that the repository's own patterns (`content/laeringsdesign/patterns/`) load as `npm run content:check` loads
 * them: every folder, with each skeleton checked against the pinned libraries `npm run h5p:fetch-libraries`
 * installs, and each pattern complete in the sense of PED-010 (phases, content types with a skeleton each, and
 * research cited in its "why it works"). The patterns are ALU's drafts, so no test names one or reads its texts.
 *
 * Spec: PED-010, PED-011
 */
import { expect, it } from 'vitest';
import { readInstalledLibraries } from '../../../src/learningDesign/content/installedLibraries.js';
import {
  loadStudioContent,
  STUDIO_CONTENT_ROOT,
} from '../../../src/learningDesign/content/loadStudioContent.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { realPatternFolders } from '../patterns/realPatterns.js';

describeWithRealPackages('[PED-010] the patterns in content/laeringsdesign/patterns/', () => {
  const { patterns } = loadStudioContent(STUDIO_CONTENT_ROOT, {
    installedLibraries: readInstalledLibraries(),
  });

  it('[PED-010] loads every pattern folder, its skeletons checked against the installed libraries', () => {
    // Act
    const ids = patterns.patterns.map((pattern) => pattern.id);
    // Assert
    expect(patterns.libraryCheck).toBe('checked');
    expect(ids).toEqual(realPatternFolders());
  });

  it('[PED-010] gives every pattern its phases, a skeleton for each content type and cited research', () => {
    // Act
    const incomplete = patterns.patterns
      .filter(
        (pattern) =>
          pattern.phases.length === 0 ||
          pattern.skeletons.map((skeleton) => skeleton.contentType).join() !== pattern.contentTypes.join() ||
          pattern.citations.length === 0,
      )
      .map((pattern) => pattern.id);
    // Assert
    expect(incomplete).toEqual([]);
  });
});
