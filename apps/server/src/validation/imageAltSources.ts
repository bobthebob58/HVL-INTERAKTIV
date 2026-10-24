/**
 * imageAltSources — where a node holds an image and its alternative text, so the alt-text rules check all of them.
 *
 * Why: H5P stores alt text in different places: `H5P.Image` has `alt` and a `decorative` flag, ImageHotspots has
 *      `backgroundImageAltText` for its background, BranchingScenario has `startScreenAltText` for its start
 *      image, and several types that Column, CoursePresentation and InteractiveBook offer as sub-content keep an
 *      image and its alt text side by side: Dialogcards (`dialogs[n].imageAltText`), MemoryGame
 *      (`cards[n].imageAlt` and `cards[n].matchAlt`), Collage (`collage.clips[n].alt`) and the QuestionSet cover
 *      (`introPage.backgroundImageAltText`, from 1.21).
 * Spec: UD-021
 * Invariants:
 *   - A source is reported only when its image file is set; an image without a file has nothing to describe.
 *     The QuestionSet cover counts only when the intro page is shown (`introPage.showIntroPage`), as the player
 *     renders it only then, and only from QuestionSet 1.21 (1.20 has no alt-text field for it).
 *   - UPSTREAM: MemoryGame counts only from 1.2. 1.1 has no alt-text fields (its cards are all «Memory Card»), and
 *     1.2 gained `imageAlt` and `matchAlt` in patch 1.2.6
 *     (https://github.com/h5p/h5p-memory-game/blob/1.2.6/semantics.json); an installed 1.2 is its latest patch.
 *   - Paths are from the params root and point at the alt-text field, for "Go to field".
 *   - Background images of CoursePresentation slides and MemoryGame's card back are decorative by design and
 *     have no alt field of their own, so they are not sources.
 *   - Only `H5P.Image` can be marked decorative; for the others an empty alt text is a finding (the players then
 *     render `alt=""`, or no alt at all in Dialogcards, and MemoryGame names its cards by the alt text).
 * Collaborators: ./rules/imageAltRule.ts, ./rules/imageAltLengthRule.ts, ./contentWalker.ts, ./contentKinds.ts.
 * Tests: apps/server/test/validation/rules/imageAltRule.test.ts
 */
import { isOlderThan } from './contentKinds.js';
import type { ContentNode } from './contentWalker.js';
import { pathOf, type PathSegment } from './contentPath.js';
import { asArray, asString, fieldAt } from './paramReaders.js';

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
 * One source: the image at `image` and its alt text at `alt`, both relative to `at` under the node's params.
 * @param node - The node.
 * @param at - Keys and indices from the node's params to the object that holds both fields.
 * @param image - The image field's key.
 * @param alt - The alt-text field's key.
 * @returns The source, or nothing when no image file is set.
 */
function sourceAt(node: ContentNode, at: readonly PathSegment[], image: string, alt: string): AltSource[] {
  const holder = fieldAt(node.params, ...at);
  if (!hasFile(fieldAt(holder, image))) return [];
  return [{ path: pathOf(node.path, ...at, alt), alt: asString(fieldAt(holder, alt)), decorative: false }];
}

/**
 * One source per list item that has an image.
 * @param node - The node.
 * @param list - Keys from the node's params to the list.
 * @param pairs - Image key and alt-text key, per item.
 * @returns The sources, in list order.
 */
const sourcesInList = (
  node: ContentNode,
  list: readonly string[],
  ...pairs: readonly (readonly [image: string, alt: string])[]
): AltSource[] =>
  asArray(fieldAt(node.params, ...list)).flatMap((_, index) =>
    pairs.flatMap(([image, alt]) => sourceAt(node, [...list, index], image, alt)),
  );

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
      return sourceAt(node, [], 'image', 'backgroundImageAltText');
    case 'H5P.BranchingScenario':
      return sourceAt(node, ['branchingScenario', 'startScreen'], 'startScreenImage', 'startScreenAltText');
    case 'H5P.QuestionSet':
      if (isOlderThan(node.library, 1, 21) || fieldAt(params, 'introPage', 'showIntroPage') !== true)
        return [];
      return sourceAt(node, ['introPage'], 'backgroundImage', 'backgroundImageAltText');
    case 'H5P.Dialogcards':
      return sourcesInList(node, ['dialogs'], ['image', 'imageAltText']);
    case 'H5P.MemoryGame':
      if (isOlderThan(node.library, 1, 2)) return [];
      return sourcesInList(node, ['cards'], ['image', 'imageAlt'], ['match', 'matchAlt']);
    case 'H5P.Collage':
      return sourcesInList(node, ['collage', 'clips'], ['image', 'alt']);
    default:
      return [];
  }
}
