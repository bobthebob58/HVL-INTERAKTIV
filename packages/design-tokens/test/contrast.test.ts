/**
 * Contrast tests for the design tokens: the WCAG 2.x formula, every foreground/background pairing the product uses,
 * and the pairings H5P's Daylight theme makes once its variables point at the tokens.
 *
 * Spec: UD-001, UD-003, UD-004, UD-011
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, MINIMUM_RATIO, relativeLuminance } from '../scripts/contrast.mjs';
import { colourHex, readTokens } from '../scripts/tokenModel.mjs';

interface Pairing {
  fg: string;
  bg: string;
  use: keyof typeof MINIMUM_RATIO;
  ratio: number;
  where: string;
}

const tokens = readTokens() as {
  color: Record<string, unknown>;
  pairings: Pairing[];
  h5pDaylight: Record<string, string>;
};
const ratioOf = (fg: string, bg: string) => contrastRatio(colourHex(tokens, fg), colourHex(tokens, bg));

/**
 * Foreground/background pairs that H5P Core 1.28 and the ten content types' libraries write with Daylight variables
 * (found in their CSS, S4). With the HVL mapping each must still pass.
 */
const DAYLIGHT_PAIRS: [fg: string, bg: string, use: Pairing['use']][] = [
  ['text-primary', 'ui-base', 'text'],
  ['text-primary', 'alternative-base', 'text'],
  ['text-primary', 'alternative-light', 'text'],
  ['text-primary', 'background', 'text'],
  ['text-secondary', 'alternative-light', 'text'],
  ['text-secondary', 'ui-base', 'text'],
  ['text-third', 'ui-base', 'text'],
  ['contrast-cta', 'main-cta-base', 'text'],
  ['contrast-cta', 'main-cta-light', 'text'],
  ['contrast-cta', 'main-cta-dark', 'text'],
  ['contrast-cta-white', 'ui-base', 'text'],
  ['contrast-cta-white', 'contrast-cta-light', 'text'],
  ['secondary-contrast-cta', 'secondary-cta-base', 'text'],
  ['secondary-contrast-cta', 'secondary-cta-light', 'text'],
  ['secondary-contrast-cta', 'secondary-cta-dark', 'text'],
  ['main-cta-base', 'ui-base', 'non-text'],
  ['main-contrast-cta', 'ui-base', 'non-text'],
  ['feedback-correct-main', 'ui-base', 'text'],
  ['feedback-correct-main', 'feedback-correct-secondary', 'text'],
  ['ui-base', 'feedback-correct-main', 'text'],
  ['feedback-incorrect-main', 'ui-base', 'text'],
  ['feedback-incorrect-main', 'feedback-incorrect-secondary', 'text'],
  ['ui-base', 'feedback-incorrect-main', 'text'],
  ['feedback-correct-third', 'ui-base', 'non-text'],
  ['feedback-incorrect-third', 'ui-base', 'non-text'],
  ['feedback-neutral-secondary', 'feedback-neutral-third', 'text'],
];

const daylightToken = (name: string): string => {
  const token = tokens.h5pDaylight[`--h5p-theme-${name}`];
  if (!token) throw new Error(`--h5p-theme-${name} is not mapped`);
  return token;
};

describe('the WCAG 2.x contrast formula', () => {
  it('[UD-001] gives 21 : 1 for black on white and 1 : 1 for equal colours', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 10);
    expect(contrastRatio('#004357', '#004357')).toBe(1);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
  });

  it('[UD-001] reproduces the ratios measured for spec 03 §2 and D-007', () => {
    expect(contrastRatio('#004357', '#FFFFFF').toFixed(2)).toBe('10.82');
    expect(contrastRatio('#008AAF', '#FFFFFF').toFixed(2)).toBe('4.00');
    expect(contrastRatio('#FF9E1B', '#FFFFFF').toFixed(2)).toBe('2.07');
  });

  it('[UD-001] refuses a value that is not #RRGGBB', () => {
    expect(() => relativeLuminance('#FFF')).toThrow(/#RRGGBB/);
    expect(() => relativeLuminance('teal')).toThrow(/#RRGGBB/);
  });
});

describe('the declared pairings', () => {
  it.each(tokens.pairings.map((p) => [`${p.fg} on ${p.bg} (${p.use})`, p] as const))(
    '[UD-001] %s meets its WCAG minimum',
    (_label, pairing) => {
      expect(ratioOf(pairing.fg, pairing.bg)).toBeGreaterThanOrEqual(MINIMUM_RATIO[pairing.use]);
    },
  );

  it.each(tokens.pairings.map((p) => [`${p.fg} on ${p.bg}`, p] as const))(
    '[UD-001] %s still has the ratio tokens.json documents',
    (_label, pairing) => {
      expect(ratioOf(pairing.fg, pairing.bg).toFixed(2)).toBe(pairing.ratio.toFixed(2));
    },
  );

  it('[UD-001] every colour token appears in at least one checked pairing', () => {
    const paired = new Set(tokens.pairings.flatMap((p) => [p.fg, p.bg]));
    expect(Object.keys(tokens.color).filter((name) => !paired.has(name))).toEqual([]);
  });

  it('[UD-004] the focus ring passes 3 : 1 on every surface it can sit on', () => {
    for (const bg of ['surface', 'surface-alt', 'band']) {
      expect(ratioOf('focus-outer', bg)).toBeGreaterThanOrEqual(MINIMUM_RATIO['non-text']);
    }
    for (const fill of ['primary-dark', 'ink']) {
      expect(ratioOf('focus-inner', fill)).toBeGreaterThanOrEqual(MINIMUM_RATIO['non-text']);
    }
  });

  it('[UD-003] the feedback text colours are AAA on their own backgrounds', () => {
    expect(ratioOf('feedback-correct-fg', 'feedback-correct-bg')).toBeGreaterThanOrEqual(7);
    expect(ratioOf('feedback-incorrect-fg', 'feedback-incorrect-bg')).toBeGreaterThanOrEqual(7);
    expect(ratioOf('feedback-info-fg', 'feedback-info-bg')).toBeGreaterThanOrEqual(7);
  });
});

describe('the H5P Daylight mapping', () => {
  it.each(DAYLIGHT_PAIRS.map(([fg, bg, use]) => [`${fg} on ${bg}`, fg, bg, use] as const))(
    '[UD-011] Daylight %s passes with the HVL tokens',
    (_label, fg, bg, use) => {
      expect(ratioOf(daylightToken(fg), daylightToken(bg))).toBeGreaterThanOrEqual(MINIMUM_RATIO[use]);
    },
  );
});
