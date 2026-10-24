/**
 * Tests for the reduced-motion script in a simulated document (jsdom) with a stand-in for H5P's jQuery: it turns
 * jQuery's animations off when the reader asks for reduced motion, follows a change of the setting, and leaves
 * jQuery alone otherwise. A real DragText revert in Chromium: apps/server/test/h5p/hvlTheme.browser.int.test.ts.
 *
 * Spec: UD-009
 */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';

const SCRIPT = readFileSync(new URL('../src/reducedMotion.js', import.meta.url), 'utf8');

/** Opens a document whose media query answers `reduce`, with or without H5P's jQuery, and runs the script. */
function openDocument(reduce: boolean, withJQuery = true) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  const listeners: (() => void)[] = [];
  const query = {
    matches: reduce,
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
  };
  const window = dom.window as unknown as Record<string, unknown>;
  window.matchMedia = () => query;
  const jQuery = { fx: { off: false } };
  if (withJQuery) window.H5P = { jQuery };
  dom.window.eval(SCRIPT);
  const change = (matches: boolean) => {
    query.matches = matches;
    for (const listener of listeners) listener();
  };
  return { dom, jQuery, change };
}

describe('the reduced-motion script', () => {
  it('[UD-009] makes jQuery animations end at once when the reader asks for reduced motion', () => {
    expect(openDocument(true).jQuery.fx.off).toBe(true);
  });

  it('[UD-009] leaves jQuery as it is without the preference', () => {
    expect(openDocument(false).jQuery.fx.off).toBe(false);
  });

  it('[UD-009] follows the setting when the reader changes it while the page is open', () => {
    // Arrange
    const { jQuery, change } = openDocument(false);
    // Act
    change(true);
    const reduced = jQuery.fx.off;
    change(false);
    // Assert
    expect([reduced, jQuery.fx.off]).toEqual([true, false]);
  });

  it('[UD-009] does nothing without H5P, runs once, and never throws', () => {
    const { dom } = openDocument(true, false);
    expect(() => dom.window.eval(SCRIPT)).not.toThrow();
    expect((dom.window as unknown as { hvlReducedMotionStarted?: boolean }).hvlReducedMotionStarted).toBe(
      true,
    );
  });

  it('[UD-009] runs under the strict H5P policy: no eval, no inline handlers, no HTML strings', () => {
    const code = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\beval\s*\(|new Function|setTimeout\s*\(\s*['"]|innerHTML|insertAdjacentHTML/);
    expect(code).not.toMatch(/\.on[a-z]+\s*=|setAttribute\(\s*['"]on/);
  });
});
