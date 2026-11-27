/**
 * Tests of where a link in an uploaded SVG may point: inside the drawing (`#id`) and nowhere else. The rule is our
 * own (src/security/svg/svgRules.ts), on top of the cleaning library's list of address kinds, so a change in that
 * list, which grows between versions (D-148), never decides what a learner's browser is asked to open.
 *
 * Spec: SEC-001
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanSvgText } from '../../src/security/svg/svgPipeline.js';

const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';
const copyDir = mkdtempSync(join(tmpdir(), 'svg-link-addresses-'));
afterAll(() => rmSync(copyDir, { recursive: true, force: true }));

/** One drawing with one link around a text; `attribute` is `href` or `xlink:href`. */
const linked = (attribute: string, address: string): string =>
  `<svg ${NS}><a ${attribute}="${address}"><text id="t">les meir</text></a></svg>`;

/** Address kinds the cleaning library lets through in a link; `matrix:` joined its list in dompurify 3.5.0. */
const OUTSIDE_ADDRESSES = [
  'https://example.org/',
  'http://example.org/',
  'ftp://example.org/file',
  'mailto:nokon@example.org',
  'tel:+4755000000',
  'sms:+4755000000',
  'xmpp:nokon@example.org',
  'matrix:r/rom:example.org',
  '//example.org/',
  'side.html',
];

describe('[SEC-001] where a link in an uploaded SVG may point', () => {
  it.each(OUTSIDE_ADDRESSES)(
    '[SEC-001] a link to %s loses its address and keeps its text',
    async (address) => {
      // Act: once as `href`, once as `xlink:href`
      const plain = await cleanSvgText(linked('href', address), copyDir);
      const xlink = await cleanSvgText(linked('xlink:href', address), copyDir);
      // Assert
      for (const output of [plain, xlink]) {
        expect(output).not.toContain('href');
        expect(output).not.toContain(address);
        expect(output).toContain('les meir');
      }
    },
  );

  it('[SEC-001] a link to a place inside the drawing is kept as written', async () => {
    // Act
    const plain = await cleanSvgText(linked('href', '#t'), copyDir);
    const xlink = await cleanSvgText(linked('xlink:href', '#t'), copyDir);
    // Assert
    expect(plain).toContain('href="#t"');
    expect(xlink).toContain('xlink:href="#t"');
  });
});
