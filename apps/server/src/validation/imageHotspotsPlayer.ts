/**
 * imageHotspotsPlayer — which ImageHotspots hotspots the player shows, and in which order it puts them in the DOM.
 *
 * Why: V-HOTSPOT-ORDER checks the order in which keyboard and screen-reader users meet the hotspots. That is the
 *      player's order, not the list order the author sees, so the rule needs a copy of the player's filter and sort.
 * Spec: UD-021
 * Invariants:
 *   - UPSTREAM: modelled on image-hotspots.js and hotspot.js of 1.5, 1.10 and 1.11
 *     (https://github.com/h5p/h5p-image-hotspots/blob/master/scripts/image-hotspots.js). From 1.10 the player
 *     drops a hotspot whose content has no item with a `library` before it sorts and numbers; in 1.5 the Hotspot
 *     constructor throws for a hotspot without content, so that one is never added either.
 *   - Valid positions sort by y, then x; a position whose x or y is 0 or missing goes last, in list order.
 *   - A library string without a version counts as the current version (see ./contentKinds.ts).
 *   - Pure: no I/O, clock or randomness (D-073).
 * Collaborators: ./rules/hotspotOrderRule.ts, ./contentKinds.ts, ./paramReaders.ts.
 * Tests: apps/server/test/validation/rules/hotspotOrderRule.test.ts
 */
import { isOlderThan } from './contentKinds.js';
import { asArray, fieldAt } from './paramReaders.js';

/** A hotspot's position, in percent of the image's width (x) and height (y). */
export interface HotspotPosition {
  /** Percent from the left edge; 0 when missing. */
  readonly x: number;
  /** Percent from the top edge; 0 when missing. */
  readonly y: number;
}

/**
 * Whether the player shows a hotspot at all.
 * @param hotspot - One item of the ImageHotspots `hotspots` list.
 * @param library - The ImageHotspots library string, e.g. `H5P.ImageHotspots 1.11`.
 * @returns False for a hotspot the player drops (no content, or from 1.10 no content item with a library).
 */
export function isShownHotspot(hotspot: unknown, library: string): boolean {
  const content = asArray(fieldAt(hotspot, 'content'));
  if (isOlderThan(library, 1, 10)) return content.length > 0;
  return content.some((item) => fieldAt(item, 'library') !== undefined);
}

// WHY: the player treats a falsy x or y (0 or missing) as invalid and moves it to the back (UPSTREAM above).
const hasValidPosition = (spot: HotspotPosition): boolean => spot.x !== 0 && spot.y !== 0;

/**
 * The order in which ImageHotspots shows hotspots that are not numbered.
 * @param spots - Positions of the shown hotspots, in list order.
 * @returns The positions in DOM (focus) order: valid ones by y, then x; the rest after them, in list order.
 */
export function playerOrder(spots: readonly HotspotPosition[]): HotspotPosition[] {
  const valid = spots.filter(hasValidPosition);
  // WHY: Array.prototype.sort is stable, so equal positions keep list order and the result is deterministic.
  valid.sort((a, b) => a.y - b.y || a.x - b.x);
  return [...valid, ...spots.filter((spot) => !hasValidPosition(spot))];
}
