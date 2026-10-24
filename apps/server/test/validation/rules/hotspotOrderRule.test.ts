/**
 * Tests for V-HOTSPOT-ORDER (hotspotOrderRule): hotspots need an order and a header. Each fixture in apps/server/test/fixtures/content/V-HOTSPOT-ORDER/ is a whole
 * activity with exactly the hits it must give; which hotspots the player shows, and in which order, is checked on
 * its own as well (imageHotspotsPlayer).
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { walkContent } from '../../../src/validation/contentWalker.js';
import { isShownHotspot, playerOrder } from '../../../src/validation/imageHotspotsPlayer.js';
import { hotspotOrderRule } from '../../../src/validation/rules/hotspotOrderRule.js';
import { messageTemplate } from '../../../src/validation/validationMessages.js';
import { TEST_CONTEXT, fixturesOf, hitsOf } from '../support/ruleFixtures.js';

const TEXT = { library: 'H5P.Text 1.1', params: { text: '<p>Tekst.</p>' } };

const icons = (...spots: readonly (readonly [x: number, y: number, header: string])[]) =>
  walkContent('H5P.ImageHotspots 1.11', {
    globalIconType: 'icon',
    hotspots: spots.map(([x, y, header]) => ({
      position: { x, y },
      hotspotIconType: 'default',
      header,
      content: [TEXT],
    })),
  });

describe('V-HOTSPOT-ORDER', () => {
  it.each(fixturesOf('V-HOTSPOT-ORDER'))('[UD-021][V-HOTSPOT-ORDER] $name: $description', (fixture) => {
    expect(hitsOf(hotspotOrderRule, fixture)).toEqual(fixture.expected);
  });

  it('[UD-021][V-HOTSPOT-ORDER] orders hotspots as ImageHotspots does: by y, then x, invalid positions last', () => {
    // Act
    const order = playerOrder([
      { x: 0, y: 10 },
      { x: 50, y: 80 },
      { x: 90, y: 18 },
      { x: 10, y: 18 },
      { x: 30, y: 0 },
    ]);
    // Assert
    expect(order).toEqual([
      { x: 10, y: 18 },
      { x: 90, y: 18 },
      { x: 50, y: 80 },
      { x: 0, y: 10 },
      { x: 30, y: 0 },
    ]);
  });

  it.each([
    ['H5P.ImageHotspots 1.11', { content: [TEXT] }, true],
    ['H5P.ImageHotspots 1.11', { content: [{ params: {} }, TEXT] }, true],
    ['H5P.ImageHotspots 1.11', { content: [{ params: {} }] }, false],
    ['H5P.ImageHotspots 1.10', { content: [] }, false],
    ['H5P.ImageHotspots 1.11', {}, false],
    ['H5P.ImageHotspots 1.5', { content: [{ params: {} }] }, true],
    ['H5P.ImageHotspots 1.5', { content: [] }, false],
  ] as const)('[UD-021][V-HOTSPOT-ORDER] %s shows the hotspot %j: %s', (library, hotspot, shown) => {
    expect(isShownHotspot(hotspot, library)).toBe(shown);
  });

  it.each([
    ['a lower hotspot listed first, which the player moves down', [50, 80, 'Nede'], [50, 20, 'Oppe'], []],
    [
      'a row whose right hotspot sits higher, read right to left',
      [10, 25, 'Venstre'],
      [90, 18, 'Høgre'],
      ['V-HOTSPOT-ORDER.unordered'],
    ],
  ] as const)(
    '[UD-021][V-HOTSPOT-ORDER] checks the order learners meet: %s',
    (_, first, second, messages) => {
      // Act
      const hits = hotspotOrderRule.check({
        nodes: icons(first, second),
        metadata: {},
        context: TEST_CONTEXT,
      });
      // Assert
      expect(hits.map((hit) => hit.message)).toEqual(messages);
    },
  );

  it.each([
    ['nn', 'nummer'],
    ['nb', 'nummer'],
    ['en', 'numbers'],
  ] as const)(
    '[UD-021][V-HOTSPOT-ORDER] offers numbers in %s only where ImageHotspots has them (from 1.11)',
    (locale, word) => {
      // Act
      const [withNumbers, withoutNumbers] = [
        messageTemplate('V-HOTSPOT-ORDER.unordered', locale),
        messageTemplate('V-HOTSPOT-ORDER.unorderedWithoutNumbers', locale),
      ];
      // Assert
      expect(withNumbers).toContain(word);
      expect(withoutNumbers).not.toContain(word);
      // WHY: the player compares heights strictly, and two hotspots placed by hand rarely get exactly one height.
      for (const text of [withNumbers, withoutNumbers])
        expect(text).not.toMatch(/same høgd|samme høyde|same height/);
    },
  );
});
