/**
 * imageAltSources — where a node holds an image and its alternative text, so the alt-text rules check all of them.
 *
 * Why: H5P stores alt text in different places: `H5P.Image` has `alt` and a `decorative` flag, ImageHotspots has
 *      `backgroundImageAltText` for its background, and BranchingScenario has `startScreenAltText` for its start
 *      image. CoursePresentation, InteractiveBook and Column embed `H5P.Image` as sub-content.
 * Spec: UD-021
 * Invariants:
 *   - A source is reported only when an image file is set; a node without an image has nothing to describe.
 *   - Paths are from the params root and point at the alt-text field, for "Go to field".
 *   - Background images of QuestionSet intro pages and CoursePresentation slides are decorative by design and
 *     have no alt field of their own, so they are not sources.
 * Collaborators: ./rules/imageAltRule.ts, ./rules/imageAltLengthRule.ts, ./contentWalker.ts.
 * Tests: apps/server/test/validation/rules/imageAltRule.test.ts
 */
import type { ContentNode } from './contentWalker.js';
import { pathOf } from './contentPath.js';
import { asString, fieldAt } from './paramReaders.js';

/** An image's alternative text and where it is. */
export interface AltSource {
  /** Path of the alt-text field. */
  readonly path: string;
  /** The alt text as stored; `undefined` when the field is missing. */
  readonly alt: string | undefined;
  /** True when the author marked the image as decorative (H5P.Image only). */
  readonly decorative: boolean;
}

const hasFile = (value: unknown): boolean => (asString(fieldAt(value, 'path')) ?? '') !== '';

/**
 * The images of one node and their alt texts.
 * @param node - A walked node.
 * @returns Its alt-text sources (none for content without images).
 */
export function altSourcesOf(node: ContentNode): readonly AltSource[] {
  const { params, path } = node;
  switch (node.machineName) {
    case 'H5P.Image':
      if (!hasFile(fieldAt(params, 'file'))) return [];
      return [
        {
          path: pathOf(path, 'alt'),
          alt: asString(fieldAt(params, 'alt')),
          decorative: fieldAt(params, 'decorative') === true,
        },
      ];
    case 'H5P.ImageHotspots':
      if (!hasFile(fieldAt(params, 'image'))) return [];
      return [
        {
          path: pathOf(path, 'backgroundImageAltText'),
          alt: asString(fieldAt(params, 'backgroundImageAltText')),
          decorative: false,
        },
      ];
    case 'H5P.BranchingScenario': {
      const start = ['branchingScenario', 'startScreen'] as const;
      if (!hasFile(fieldAt(params, ...start, 'startScreenImage'))) return [];
      return [
        {
          path: pathOf(path, ...start, 'startScreenAltText'),
          alt: asString(fieldAt(params, ...start, 'startScreenAltText')),
          decorative: false,
        },
      ];
    }
    default:
      return [];
  }
}
