/**
 * Renders every benign SVG in Chromium before and after sanitising and compares the screenshots pixel for pixel.
 *
 * Spec: SEC-001
 */
import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser } from 'playwright-core';
import { sanitizeSvgText } from '../../src/security/SvgSanitizer.js';
import { describeWithBrowser } from '../support/browser.js';

const benignDir = join(import.meta.dirname, '../fixtures/svg/benign');
const benign = readdirSync(benignDir).sort();
const SIZE = 200;

/** Screenshot of an SVG drawn as an <img> from a data URL on a white, fixed-size page. */
async function render(browser: Browser, svg: string | undefined): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  try {
    const image = svg
      ? `<img id="drawing" width="${SIZE}" height="${SIZE}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`
      : '';
    await page.setContent(
      `<!DOCTYPE html><html><body style="margin:0;background:#ffffff">${image}</body></html>`,
    );
    if (svg) await page.locator('#drawing').evaluate((img: HTMLImageElement) => img.decode());
    return await page.screenshot({ clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
  } finally {
    await page.close();
  }
}

describeWithBrowser('[SEC-001] SvgSanitizer rendering', (browser) => {
  it('[SEC-001] benign SVGs render identically before and after sanitising', async () => {
    expect(benign.length).toBeGreaterThanOrEqual(6);
    const blank = await render(browser(), undefined);
    for (const name of benign) {
      const original = readFileSync(join(benignDir, name), 'utf8');
      const before = await render(browser(), original);
      const after = await render(browser(), await sanitizeSvgText(original));
      expect(before.equals(blank), `${name} draws something`).toBe(false);
      expect(after.equals(before), `${name} looks the same after sanitising`).toBe(true);
    }
  });
});
