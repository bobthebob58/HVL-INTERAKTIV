/**
 * Tests that the repository's own patterns (`content/laeringsdesign/patterns/`) load as `npm run content:check` loads
 * them: every folder, with each skeleton checked against the pinned libraries `npm run h5p:fetch-libraries`
 * installs, and each pattern complete in the sense of PED-010 (phases, content types with a skeleton each, and
 * research cited in its "why it works"). The patterns are ALU's drafts, so no test reads their texts; what spec 04 §4
 * fixes (the nine IDs, each with its phases and content types) is pinned, and a pattern beside them is allowed
 * (PED-011).
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

/** Spec 04 §4's table, sorted: each pattern's phases and content types (spec keys, not ALU's texts). */
const SPEC_04_PATTERNS: Readonly<Record<string, readonly [readonly string[], readonly string[]]>> = {
  'fa-video': [['forarbeid'], ['H5P.InteractiveVideo']],
  'fa-slides': [['forarbeid'], ['H5P.CoursePresentation']],
  'fa-hotspots': [['forarbeid'], ['H5P.ImageHotspots']],
  'uv-case': [['underveis'], ['H5P.BranchingScenario']],
  'uv-module': [['underveis'], ['H5P.InteractiveBook']],
  'uv-column': [['underveis'], ['H5P.Column']],
  'ea-retrieval': [['etterarbeid'], ['H5P.QuestionSet']],
  'ea-terms': [['etterarbeid'], ['H5P.Blanks', 'H5P.DragText']],
  'ea-diagnose': [['etterarbeid', 'forarbeid'], ['H5P.MultiChoice']],
};

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

  it('[PED-010] holds the nine patterns of spec 04 §4, each with the phases and content types of its table', () => {
    // Act: PED-011 lets ALU add a pattern beside the nine, so only the nine are compared
    const nine = patterns.patterns
      .filter((pattern) => Object.hasOwn(SPEC_04_PATTERNS, pattern.id))
      .map((pattern) => [pattern.id, [[...pattern.phases].sort(), [...pattern.contentTypes].sort()]]);
    // Assert
    expect(Object.fromEntries(nine)).toEqual(SPEC_04_PATTERNS);
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
