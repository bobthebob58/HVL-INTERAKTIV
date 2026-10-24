/**
 * Contrast tests for the design tokens: the WCAG 2.x formula, every foreground/background pairing the product uses,
 * and the pairings H5P's Daylight theme draws once its variables point at the tokens, including the shades a
 * library mixes from them and the colours HVL's theme draws over them.
 *
 * Spec: UD-001, UD-003, UD-004, UD-011
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, MINIMUM_RATIO, relativeLuminance, srgbMix } from '../scripts/contrast.mjs';
import { pairingHex, pairingTokens, readTokens } from '../scripts/tokenModel.mjs';

/** A token name, or a `color-mix(in srgb, a <percent>%, b)` of two tokens. */
type Side = string | { mix: [string, number, string] };

interface Pairing {
  fg: Side;
  bg: Side;
  use: keyof typeof MINIMUM_RATIO;
  ratio: number;
  where: string;
}

const tokens = readTokens() as {
  color: Record<string, unknown>;
  pairings: Pairing[];
  h5pDaylight: Record<string, string>;
};
const ratioOf = (fg: Side, bg: Side) => contrastRatio(pairingHex(tokens, fg), pairingHex(tokens, bg));
const nameOf = (side: Side) =>
  typeof side === 'string' ? side : `mix(${side.mix[0]} ${side.mix[1]}%, ${side.mix[2]})`;

/** A Daylight variable (short name), a shade a library mixes from two, or an HVL token the theme draws over them. */
type DrawnSide = string | { mix: [string, number, string] } | { hvl: string };

/**
 * Foreground/background pairs that H5P Core 1.28 and the ten content types' libraries draw with Daylight variables
 * (found in their CSS, S4), and where HVL's theme replaces a colour, the colour it draws instead
 * (packages/hvl-h5p-theme). With the HVL mapping each must pass.
 */
const DAYLIGHT_PAIRS: [fg: DrawnSide, bg: DrawnSide, use: Pairing['use']][] = [
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
  // Components 1.0 draggable (DragText's word, hovered or grabbed): text-primary on alternative-dark; SingleChoiceSet
  // 1.11's hovered alternative: text-secondary on alternative-dark.
  ['text-primary', 'alternative-dark', 'text'],
  ['text-secondary', 'alternative-dark', 'text'],
  // Components 1.0 inline drop zone (DragText): HVL's border, not alternative-dark (1.38 : 1), on its container.
  [{ hvl: 'ink-muted' }, 'alternative-light', 'non-text'],
  // CoursePresentation 1.28 task dots, answered ones filled with their ring colour by HVL's theme (not
  // main-contrast-cta): on a part already shown, and on a part not yet shown with its mixed background.
  ['secondary-contrast-cta', 'secondary-cta-base', 'non-text'],
  ['secondary-cta-base', { mix: ['secondary-cta-base', 20, 'secondary-contrast-cta'] }, 'non-text'],
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

/** The token side a drawn colour resolves to with the HVL mapping. */
const drawnSide = (side: DrawnSide): Side => {
  if (typeof side === 'string') return daylightToken(side);
  if ('hvl' in side) return side.hvl;
  return { mix: [daylightToken(side.mix[0]), side.mix[1], daylightToken(side.mix[2])] };
};
const drawnName = (side: DrawnSide) =>
  typeof side === 'string' ? side : 'hvl' in side ? `hvl ${side.hvl}` : nameOf(side);

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

  it('[UD-011] mixes colours as color-mix(in srgb, …) does, for shades a library derives', () => {
    expect(srgbMix('#C9D5DA', 20, '#111111')).toBe('#363839');
    expect(srgbMix('#000000', 50, '#FFFFFF')).toBe('#808080');
    expect(() => srgbMix('#000000', 120, '#FFFFFF')).toThrow(/percentage/);
  });

  it('[UD-001] refuses a value that is not #RRGGBB', () => {
    expect(() => relativeLuminance('#FFF')).toThrow(/#RRGGBB/);
    expect(() => relativeLuminance('teal')).toThrow(/#RRGGBB/);
  });
});

describe('the declared pairings', () => {
  it.each(tokens.pairings.map((p) => [`${nameOf(p.fg)} on ${nameOf(p.bg)} (${p.use})`, p] as const))(
    '[UD-001] %s meets its WCAG minimum',
    (_label, pairing) => {
      expect(ratioOf(pairing.fg, pairing.bg)).toBeGreaterThanOrEqual(MINIMUM_RATIO[pairing.use]);
    },
  );

  it.each(tokens.pairings.map((p) => [`${nameOf(p.fg)} on ${nameOf(p.bg)}`, p] as const))(
    '[UD-001] %s still has the ratio tokens.json documents',
    (_label, pairing) => {
      expect(ratioOf(pairing.fg, pairing.bg).toFixed(2)).toBe(pairing.ratio.toFixed(2));
    },
  );

  it('[UD-001] every colour token appears in at least one checked pairing', () => {
    const paired = new Set(tokens.pairings.flatMap((p) => [...pairingTokens(p.fg), ...pairingTokens(p.bg)]));
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
  it.each(
    DAYLIGHT_PAIRS.map(([fg, bg, use]) => [`${drawnName(fg)} on ${drawnName(bg)}`, fg, bg, use] as const),
  )('[UD-011] Daylight %s passes with the HVL tokens', (_label, fg, bg, use) => {
    expect(ratioOf(drawnSide(fg), drawnSide(bg))).toBeGreaterThanOrEqual(MINIMUM_RATIO[use]);
  });

  it('[UD-001] every pair drawn over Daylight is declared in tokens.json, with a use at least as strict', () => {
    // Arrange
    const declared = tokens.pairings.map((p) => [nameOf(p.fg), nameOf(p.bg), MINIMUM_RATIO[p.use]] as const);
    const drawn = DAYLIGHT_PAIRS.map(
      ([fg, bg, use]) => [nameOf(drawnSide(fg)), nameOf(drawnSide(bg)), MINIMUM_RATIO[use]] as const,
    );
    // Act
    const missing = drawn.filter(
      ([fg, bg, min]) => !declared.some(([dfg, dbg, dmin]) => dfg === fg && dbg === bg && dmin >= min),
    );
    // Assert
    expect(missing.map(([fg, bg]) => `${fg} on ${bg}`)).toEqual([]);
  });
});
