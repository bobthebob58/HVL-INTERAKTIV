/**
 * requiredMedia — the media an activity cannot be shown without and does not have yet: an InteractiveVideo without a
 * video source, and an ImageHotspots without a background image, anywhere in the activity.
 *
 * Why: a pattern's skeleton leaves these slots for the author (D-084, D-086 amendment). Without them a learner sees
 *      only the library's own English error ("Video source is missing.", "Missing required background image")
 *      instead of the activity, and no other rule reports it (an absent video has no captions to miss).
 * Spec: PROD-001, UD-020
 * Invariants:
 *   - InteractiveVideo: no file in `interactiveVideo.video.files` with a non-empty path (H5P.Video shows its error
 *     when it has no source). ImageHotspots: `image` is missing or has no path (the player checks for none).
 *   - Every node of those types counts, also as sub-content; each gap is reported at its field's path.
 *   - Pure: reads the walked nodes only.
 * Collaborators: ./rules/placeholderRule.ts, ./contentWalker.ts, ./contentPath.ts, ./paramReaders.ts.
 * Tests: apps/server/test/validation/rules/placeholderRule.test.ts
 */
import type { ContentNode } from './contentWalker.js';
import { pathOf } from './contentPath.js';
import { asArray, asString, fieldAt } from './paramReaders.js';

/** Which required medium is missing. */
export type MissingMediumKind = 'video' | 'backgroundImage';

/** A required medium that is missing, and where. */
export interface MissingMedium {
  readonly kind: MissingMediumKind;
  /** The path of the field the author fills in. */
  readonly path: string;
}

const hasPath = (file: unknown): boolean => (asString(fieldAt(file, 'path'))?.trim() ?? '') !== '';

/**
 * The required media the walked nodes lack.
 * @param nodes - The activity and its sub-content (contentWalker).
 * @returns Each gap, in walk order.
 * @spec PROD-001
 */
export function missingMedia(nodes: readonly ContentNode[]): MissingMedium[] {
  return nodes.flatMap((node): MissingMedium[] => {
    if (node.machineName === 'H5P.InteractiveVideo') {
      const files = asArray(fieldAt(node.params, 'interactiveVideo', 'video', 'files'));
      return files.some(hasPath)
        ? []
        : [{ kind: 'video', path: pathOf(node.path, 'interactiveVideo', 'video', 'files') }];
    }
    if (node.machineName === 'H5P.ImageHotspots') {
      return hasPath(fieldAt(node.params, 'image'))
        ? []
        : [{ kind: 'backgroundImage', path: pathOf(node.path, 'image') }];
    }
    return [];
  });
}
