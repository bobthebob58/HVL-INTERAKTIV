/**
 * hotspotOrderRule (V-HOTSPOT-ORDER) — the order in which keyboard and screen-reader users meet ImageHotspots
 * hotspots follows the image or is shown by numbers, and each hotspot has a header text.
 *
 * Why: WCAG 1.3.2 (Meaningful Sequence), 2.4.3 (Focus Order) and 2.4.6 (Headings and Labels). The hotspots are
 *      focusable in DOM order. Unless the icons are numbers, ImageHotspots sorts them by height before it builds
 *      the DOM (strictly by y, then by x), so the list order never reaches the learner, but hotspots placed by
 *      hand on one visual row are read from right to left when the right one sits a little higher. A hotspot
 *      without a header is announced only as «Markør utan tittel».
 * Spec: UD-021
 * Invariants:
 *   - UPSTREAM: only the hotspots the player shows count, in the player's DOM order; both are modelled on
 *     ImageHotspots 1.5, 1.10 and 1.11 in ../imageHotspotsPlayer.ts
 *     (https://github.com/h5p/h5p-image-hotspots/blob/master/scripts/image-hotspots.js).
 *   - With `globalIconType: "numbers"` (from 1.11) the player keeps the list order and numbers only the hotspots
 *     with the default icon (`hotspotIconType: "default"`). All numbered: any order is fine. Some unnumbered: the
 *     list order must follow the image. A missing `hotspotIconType` gets no number, as in the player.
 *   - Following the image: each hotspot is on a lower row than the one before, or on the same row (within
 *     ROW_TOLERANCE percentage points of height) and not to its left. Positions are percentages of the image.
 *   - One order finding per ImageHotspots (path `hotspots`); its remedy offers numbers only from 1.11, as older
 *     versions have no such icon type. One header finding per shown hotspot (path `header`).
 * Collaborators: ../imageHotspotsPlayer.ts, ../paramReaders.ts, ../contentKinds.ts.
 * Tests: apps/server/test/validation/rules/hotspotOrderRule.test.ts
 */
import { isOlderThan } from '../contentKinds.js';
import { pathOf } from '../contentPath.js';
import { isShownHotspot, playerOrder, type HotspotPosition } from '../imageHotspotsPlayer.js';
import { asArray, asNumber, asString, fieldAt } from '../paramReaders.js';
import { plainTextOf } from '../richText.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';

// WHY: authors place hotspots by hand, so hotspots meant to be on one row differ by a few percent in height.
const ROW_TOLERANCE = 10;

const inReadingOrder = (spots: readonly HotspotPosition[]): boolean =>
  spots.every((spot, i) => {
    const before = spots[i - 1];
    if (!before) return true;
    if (spot.y > before.y + ROW_TOLERANCE) return true;
    return Math.abs(spot.y - before.y) <= ROW_TOLERANCE && spot.x >= before.x;
  });

/** V-HOTSPOT-ORDER: hotspots need an order and a header. */
export const hotspotOrderRule: ValidationRule = {
  id: 'V-HOTSPOT-ORDER',
  requirement: 'UD-021',
  severity: 'warning',
  messages: [
    'V-HOTSPOT-ORDER.unordered',
    'V-HOTSPOT-ORDER.unorderedWithoutNumbers',
    'V-HOTSPOT-ORDER.partlyNumbered',
    'V-HOTSPOT-ORDER.noHeader',
  ],
  check(scope) {
    const hits: RuleHit[] = [];
    for (const node of nodesOf(scope, 'H5P.ImageHotspots')) {
      const hotspots = asArray(fieldAt(node.params, 'hotspots'));
      const visible = hotspots.map((h) => isShownHotspot(h, node.library));
      const shown = hotspots.filter((_, index) => visible[index]);
      const spots = shown.map((h) => ({
        x: asNumber(fieldAt(h, 'position', 'x')) ?? 0,
        y: asNumber(fieldAt(h, 'position', 'y')) ?? 0,
      }));
      const numbers = fieldAt(node.params, 'globalIconType') === 'numbers';
      // WHY: the player numbers only `hotspotIconType === 'default'`; a missing value gets no number either.
      const allNumbered = shown.every((h) => fieldAt(h, 'hotspotIconType') === 'default');
      const ordersPath = pathOf(node.path, 'hotspots');
      if (shown.length > 1 && !numbers && !inReadingOrder(playerOrder(spots))) {
        const offersNumbers = !isOlderThan(node.library, 1, 11);
        const message = offersNumbers
          ? 'V-HOTSPOT-ORDER.unordered'
          : 'V-HOTSPOT-ORDER.unorderedWithoutNumbers';
        hits.push({ path: ordersPath, message });
      } else if (shown.length > 1 && numbers && !allNumbered && !inReadingOrder(spots)) {
        hits.push({ path: ordersPath, message: 'V-HOTSPOT-ORDER.partlyNumbered' });
      }
      hotspots.forEach((hotspot, index) => {
        if (!visible[index] || plainTextOf(asString(fieldAt(hotspot, 'header')) ?? '') !== '') return;
        hits.push({
          path: pathOf(node.path, 'hotspots', index, 'header'),
          message: 'V-HOTSPOT-ORDER.noHeader',
        });
      });
    }
    return hits;
  },
};
