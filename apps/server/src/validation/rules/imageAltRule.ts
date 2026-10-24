/**
 * imageAltRule (V-IMG-ALT) — every image that carries content has a real alternative text.
 *
 * Why: WCAG 1.1.1 (Non-text Content): a screen reader reads the alt text instead of the image. An empty alt, or
 *      one that is only a file name ("IMG_1234.jpg", «bilde»), leaves the learner without the information.
 * Spec: UD-021
 * Invariants:
 *   - Images marked decorative (`H5P.Image` `decorative: true`) need no alt text.
 *   - Covers `H5P.Image` anywhere (also inside ImageHotspots, CoursePresentation, InteractiveBook, Column), the
 *     ImageHotspots background, the BranchingScenario start image, the QuestionSet cover (from 1.21), and the
 *     images of Dialogcards, MemoryGame (from 1.2) and Collage (see ../imageAltSources.ts).
 *   - Severity error: publishing needs a fix or an acknowledgement (PROD-003).
 * Collaborators: ../imageAltSources.ts, ../richText.ts.
 * Tests: apps/server/test/validation/rules/imageAltRule.test.ts
 */
import { altSourcesOf } from '../imageAltSources.js';
import { plainTextOf } from '../richText.js';
import type { RuleHit, ValidationRule } from '../rule.js';

// WHY: the spec's examples of alt texts that are file names: an image extension, camera and default names
// ("IMG_1234", "DSC_0042", "image1", «bilde»), or no letters at all ("1234", "-").
const FILE_NAME_PATTERNS: readonly RegExp[] = [
  /\.(?:jpe?g|png|gif|webp|svg|bmp|tiff?|heic|avif)$/i,
  /^(?:img|image|bilde|bilete|picture|pic|photo|foto|screenshot|skjermbilde|skjermbilete|dsc|dscn|pxl)[\s_-]*\d*$/i,
  /^[^\p{L}]+$/u,
];

/**
 * Tells whether an alt text looks like a file name rather than a description.
 * @param alt - Plain alt text, trimmed.
 * @returns True for e.g. `IMG_1234`, `diagram.png`, `bilde`, `image1`.
 */
export const looksLikeFileName = (alt: string): boolean =>
  FILE_NAME_PATTERNS.some((pattern) => pattern.test(alt));

/** V-IMG-ALT: images need a real alternative text. */
export const imageAltRule: ValidationRule = {
  id: 'V-IMG-ALT',
  requirement: 'UD-021',
  severity: 'error',
  messages: ['V-IMG-ALT.missing', 'V-IMG-ALT.fileName'],
  check(scope) {
    const hits: RuleHit[] = [];
    for (const source of scope.nodes.flatMap(altSourcesOf)) {
      if (source.decorative) continue;
      const alt = plainTextOf(source.alt ?? '');
      if (alt === '') hits.push({ path: source.path, message: 'V-IMG-ALT.missing' });
      else if (looksLikeFileName(alt))
        hits.push({ path: source.path, message: 'V-IMG-ALT.fileName', values: { alt } });
    }
    return hits;
  },
};
