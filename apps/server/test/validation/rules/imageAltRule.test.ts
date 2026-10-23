/**
 * Tests for V-IMG-ALT (imageAltRule): images need a real alternative text. Each fixture in apps/server/test/fixtures/content/V-IMG-ALT/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: UD-021
 */
import { describe, expect, it } from 'vitest';
import { imageAltRule, looksLikeFileName } from '../../../src/validation/rules/imageAltRule.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('V-IMG-ALT', () => {
  it.each(fixturesOf('V-IMG-ALT'))('[UD-021][V-IMG-ALT] $name: $description', (fixture) => {
    expect(hitsOf(imageAltRule, fixture)).toEqual(fixture.expected);
  });

  it.each([
    'IMG_1234',
    'IMG_1234.JPG',
    'diagram.png',
    'bilde',
    'Bilete 3',
    'image1',
    'DSC_0042',
    '1234',
    '-',
  ])('[UD-021][V-IMG-ALT] treats «%s» as a file name', (alt) => {
    expect(looksLikeFileName(alt)).toBe(true);
  });

  it.each(['Diagram over dei tre fasane', 'Ein student les på biblioteket', 'Bilde av HVL-campus i Bergen'])(
    '[UD-021][V-IMG-ALT] accepts «%s» as a description',
    (alt) => {
      expect(looksLikeFileName(alt)).toBe(false);
    },
  );
});
