/**
 * hotspotOrderRule (V-HOTSPOT-ORDER) — ImageHotspots hotspots are numbered or in reading order, and each has a
 * header text.
 *
 * Why: WCAG 1.3.2 (Meaningful Sequence) and 2.4.6 (Headings and Labels): keyboard and screen-reader users meet
 *      the hotspots in list order. If that order jumps around the image and the hotspots carry no numbers, the
 *      sequence makes no sense; a hotspot without a header is announced only as «Markør utan tittel».
 * Spec: UD-021
 * Invariants:
 *   - Numbered means `globalIconType: "numbers"` (H5P then numbers the hotspots in list order).
 *   - Reading order: each hotspot is on a lower row than the one before, or on the same row (within
 *     ROW_TOLERANCE percentage points of height) and not to its left. Positions are percentages of the image.
 *   - One order finding per ImageHotspots (path `hotspots`); one header finding per hotspot (path `header`).
 * Collaborators: ../paramReaders.ts.
 * Tests: apps/server/test/validation/rules/hotspotOrderRule.test.ts
 */
import { pathOf } from '../contentPath.js';
import { asArray, asNumber, asString, fieldAt } from '../paramReaders.js';
import { plainTextOf } from '../richText.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';

// WHY: authors place hotspots by hand, so hotspots meant to be on one row differ by a few percent in height.
const ROW_TOLERANCE = 10;

interface Spot {
  readonly x: number;
  readonly y: number;
}

const inReadingOrder = (spots: readonly Spot[]): boolean =>
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
  messages: ['V-HOTSPOT-ORDER.unordered', 'V-HOTSPOT-ORDER.noHeader'],
  check(scope) {
    const hits: RuleHit[] = [];
    for (const node of nodesOf(scope, 'H5P.ImageHotspots')) {
      const hotspots = asArray(fieldAt(node.params, 'hotspots'));
      const spots = hotspots.map((h) => ({
        x: asNumber(fieldAt(h, 'position', 'x')) ?? 0,
        y: asNumber(fieldAt(h, 'position', 'y')) ?? 0,
      }));
      const numbered = fieldAt(node.params, 'globalIconType') === 'numbers';
      if (hotspots.length > 1 && !numbered && !inReadingOrder(spots)) {
        hits.push({ path: pathOf(node.path, 'hotspots'), message: 'V-HOTSPOT-ORDER.unordered' });
      }
      hotspots.forEach((hotspot, index) => {
        if (plainTextOf(asString(fieldAt(hotspot, 'header')) ?? '') !== '') return;
        hits.push({
          path: pathOf(node.path, 'hotspots', index, 'header'),
          message: 'V-HOTSPOT-ORDER.noHeader',
        });
      });
    }
    return hits;
  },
};
