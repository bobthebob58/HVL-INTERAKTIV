/**
 * Tests for the one-pass scan of `url(...)` functions in CSS text: what counts as a well-formed function, that it
 * finds exactly what the single pattern it replaced found, and that its time grows in step with the text's length.
 *
 * Spec: SEC-001
 */
import { describe, expect, it } from 'vitest';
import { replaceCssUrls, scanCssUrls } from '../../src/security/svg/cssUrlScan.js';

/** The pattern the scan replaced (D-118); kept here only as the reference for what a function is. */
const REFERENCE = /url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^"'()\s]*))\s*\)/gi;

const referenceFunctions = (css: string) =>
  [...css.matchAll(REFERENCE)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    value: m[1] ?? m[2] ?? m[3] ?? '',
  }));

/** Every text of up to `length` pieces from `pieces`, each once. */
function* textsOf(pieces: readonly string[], length: number): Generator<string> {
  yield '';
  if (length === 0) return;
  for (const piece of pieces) for (const rest of textsOf(pieces, length - 1)) yield piece + rest;
}

describe('[SEC-001] the scan of url() functions in CSS', () => {
  it('[SEC-001] reads double-quoted, single-quoted and bare values, in any letter case and with white space', () => {
    expect(scanCssUrls('a{fill:url(#g)}')).toEqual([{ start: 7, end: 14, value: '#g' }]);
    expect(scanCssUrls('URL( "#a b" )')).toEqual([{ start: 0, end: 13, value: '#a b' }]);
    expect(scanCssUrls("uRl\t('x')")).toEqual([{ start: 0, end: 9, value: 'x' }]);
    expect(scanCssUrls('url()')).toEqual([{ start: 0, end: 5, value: '' }]);
    expect(scanCssUrls('url\u00a0(\u2003#g\u3000)')).toEqual([{ start: 0, end: 10, value: '#g' }]);
    expect(scanCssUrls('curl up; url (#a) url(#b)').map((url) => url.value)).toEqual(['#a', '#b']);
    expect(scanCssUrls('no function here: url, urls')).toEqual([]);
  });

  it('[SEC-001] reports a url( that is not a well-formed function without a value', () => {
    for (const css of ['url(x.png}', 'url("x', 'url(\'x" )', 'url(a b)', 'url("a"b)', 'url(', 'url(a(b))']) {
      expect(scanCssUrls(css)[0], css).toEqual({ start: 0, end: 4 });
    }
    // A url( inside a well-formed function's value belongs to that value; after a malformed one the scan goes on.
    expect(scanCssUrls('url("url(#a)")')).toEqual([{ start: 0, end: 14, value: 'url(#a)' }]);
    expect(scanCssUrls('url( url(#a) )')).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 12, value: '#a' },
    ]);
  });

  it('[SEC-001] finds exactly the functions the replaced pattern found, on every short text', () => {
    // Arrange: every text of up to five pieces that matter to the grammar
    const pieces = ['url', 'URL', '(', ')', ' ', '\t', '"', "'", '#a', 'x', '\u00a0'];
    let compared = 0;
    // Act and assert
    for (const css of textsOf(pieces, 5)) {
      const wellFormed = scanCssUrls(css).filter((url) => url.value !== undefined);
      if (JSON.stringify(wellFormed) !== JSON.stringify(referenceFunctions(css))) {
        expect(wellFormed, JSON.stringify(css)).toEqual(referenceFunctions(css));
      }
      compared += 1;
    }
    expect(compared).toBeGreaterThan(150_000);
  });

  it('[SEC-001] replaces only well-formed functions, and only those the caller names', () => {
    const external = (value: string) => (value.startsWith('#') ? undefined : 'none');
    expect(replaceCssUrls('a{fill:url(#g);background:url("https://x/y.png")}', external)).toBe(
      'a{fill:url(#g);background:none}',
    );
    expect(replaceCssUrls('url(x) url(y', external)).toBe('none url(y');
    expect(replaceCssUrls('', external)).toBe('');
  });

  it('[SEC-001] takes time in step with the length of the text', () => {
    // Arrange: long runs of white space, of value characters and of opened quotes
    const texts = [
      `url(${' '.repeat(1_000_000)}(`,
      `url${' '.repeat(1_000_000)}x`,
      `url(${'a'.repeat(1_000_000)}`,
      'url("'.repeat(200_000),
      "url('".repeat(100_000) + 'url("'.repeat(100_000),
    ];
    // Act and assert
    for (const css of texts) {
      const started = performance.now();
      scanCssUrls(css);
      expect(performance.now() - started, css.slice(0, 12)).toBeLessThan(250);
    }
  });
});
