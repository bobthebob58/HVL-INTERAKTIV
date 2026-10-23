/**
 * Tests for the SVG sanitiser: every malicious fixture comes out inert or is refused, DTD tricks are refused,
 * non-SVG paths are ignored, upper-case paths are sanitised, and benign drawings keep their elements.
 *
 * Spec: SEC-001
 */
import { describe, it, expect, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSanitizerResult } from '@lumieducation/h5p-server';
import { SvgSanitizer } from '../../src/security/SvgSanitizer.js';
import { LumiSvgSanitizer } from '../../src/h5p/lumiInternals.js';
import { RejectedUploadError } from '../../src/security/RejectedUploadError.js';
import { svgElementNames, svgProblems } from '../support/svgInertness.js';

const fixtures = join(import.meta.dirname, '../fixtures/svg');
const malicious = readdirSync(join(fixtures, 'malicious')).sort();
const benign = readdirSync(join(fixtures, 'benign')).sort();
/** Fixtures whose DTD must make the sanitiser refuse the file instead of cleaning it. */
const REFUSED = ['billion-laughs.svg', 'xxe-external-entity.svg'];

const dir = mkdtempSync(join(tmpdir(), 'svg-sanitizer-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;
const sanitizer = new SvgSanitizer();

const place = (name: string, text: string): string => {
  const folder = join(dir, String((counter += 1)));
  mkdirSync(folder);
  writeFileSync(join(folder, name), text);
  return join(folder, name);
};
const fixture = (kind: string, name: string) => readFileSync(join(fixtures, kind, name), 'utf8');

const expectRefused = async (text: string, name = 'drawing.svg') => {
  const path = place(name, text);
  const error = await sanitizer.sanitize(path).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(RejectedUploadError);
  expect((error as RejectedUploadError).messageKey).toBe('upload.file.svgRejected');
  expect(readFileSync(path, 'utf8'), 'a refused file is left as it was').toBe(text);
};

describe('[SEC-001] SvgSanitizer', () => {
  it('[SEC-001] the corpus has an annotated fixture for each attack class SEC-001 names', () => {
    // WHY: one fixture per class spec 01 SEC-001 names: entities, scripts, handlers, foreignObject, script and
    // data:text/html URLs, external references.
    const named = 'billion-laughs xxe-external-entity inline-script event-handlers foreignobject-html ';
    for (const name of `${named}javascript-href data-html-href external-image external-use`.split(' '))
      expect(malicious, name).toContain(`${name}.svg`);
    expect(malicious.length).toBeGreaterThanOrEqual(17);
    for (const name of malicious) expect(fixture('malicious', name), name).toMatch(/<!-- Attack: .{20,}-->/);
    expect(benign.length).toBeGreaterThanOrEqual(6);
  });

  it.each(malicious.filter((name) => !REFUSED.includes(name)))('[SEC-001] neutralises %s', async (name) => {
    // Arrange
    const path = place('upload.svg', fixture('malicious', name));
    // Act and assert
    expect(await sanitizer.sanitize(path)).toBe(FileSanitizerResult.Sanitized);
    const output = readFileSync(path, 'utf8');
    expect(svgProblems(output)).toEqual([]);
    // WHY: Lumi's pass keeps the text of elements it removes (e.g. "alert(1)" from svg:script) as inert text.
    const markup = output.replace(/>[^<]*</g, '><');
    expect(markup).not.toMatch(
      /alert\(|attacker\.example|javascript:|data:text\/html|<script|onload|onclick/i,
    );
    expect(output, 'the rest of the drawing survives').toMatch(
      /<rect id="keep" width="10" height="10" fill="#004357"/,
    );
  });

  it('[SEC-001] refuses internal DTD subsets and entities', async () => {
    for (const name of REFUSED) await expectRefused(fixture('malicious', name));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    await expectRefused(`<!DOCTYPE svg []>${svg}`);
    await expectRefused(`<!doctype svg [ <!ATTLIST svg onload CDATA "alert(1)"> ]>${svg}`);
    await expectRefused(`<!DOCTYPE svg SYSTEM "x.dtd" [ ]>${svg}`);
    await expectRefused(`<!-- <!entity hidden "in a comment"> -->${svg}`);
    await expectRefused(`<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "a.dtd"><!DOCTYPE svg [ ]>${svg}`);
  });

  it('[SEC-001] removes a plain public DOCTYPE and xml-stylesheet instructions', async () => {
    // Arrange
    const text = fixture('benign', 'inkscape-export.svg');
    const path = place('figur.svg', text);
    // Act and assert: a public DOCTYPE, then xml-stylesheet instructions
    expect(await sanitizer.sanitize(path)).toBe(FileSanitizerResult.Sanitized);
    expect(readFileSync(path, 'utf8')).not.toMatch(/<!DOCTYPE|<\?/);
    const styled = place(
      'styled.svg',
      '<?XML-STYLESHEET href="https://attacker.example/x.css"?><svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    expect(await sanitizer.sanitize(styled)).toBe(FileSanitizerResult.Sanitized);
    expect(readFileSync(styled, 'utf8')).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
    // An unterminated instruction swallows the rest of the file, so nothing usable is left.
    await expectRefused(
      '<?xml-stylesheet href="https://attacker.example/x.css"<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
  });

  it('[SEC-001] ignores files that are not SVG', async () => {
    const scripted = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    for (const name of ['image.png', 'drawing.svgz', 'drawing.svg.txt', 'svg', 'noext']) {
      const path = place(name, scripted);
      expect(await sanitizer.sanitize(path), name).toBe(FileSanitizerResult.Ignored);
      expect(readFileSync(path, 'utf8'), name).toBe(scripted);
    }
  });

  it('[SEC-001] also sanitises an upper-case .SVG path', async () => {
    const scripted =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>';
    for (const name of ['IMAGE.SVG', 'Figur.Svg', '.svg']) {
      const path = place(name, scripted);
      expect(await sanitizer.sanitize(path), name).toBe(FileSanitizerResult.Sanitized);
      const output = readFileSync(path, 'utf8');
      expect(output, name).not.toContain('script');
      expect(output, name).toContain('<rect width="1" height="1"/>');
    }
  });

  it("[SEC-001] runs Lumi's sanitiser on a lower-case .svg copy, also for an upper-case upload (D-044)", async () => {
    const lumi = vi.spyOn(LumiSvgSanitizer.prototype, 'sanitize');
    try {
      await sanitizer.sanitize(place('FIGUR.SVG', '<svg xmlns="http://www.w3.org/2000/svg"/>'));
      expect(lumi).toHaveBeenCalledTimes(1);
      expect(lumi.mock.calls[0]?.[0]).toMatch(/hvl-svg-[^/]+\/upload\.svg$/);
      expect(await lumi.mock.results[0]?.value).toBe(FileSanitizerResult.Sanitized);
    } finally {
      lumi.mockRestore();
    }
  });

  it.each(benign)('[SEC-001] benign %s keeps its SVG elements', async (name) => {
    const original = fixture('benign', name);
    const path = place(name, original);
    expect(await sanitizer.sanitize(path)).toBe(FileSanitizerResult.Sanitized);
    const output = readFileSync(path, 'utf8');
    expect(svgProblems(output)).toEqual([]);
    expect(svgElementNames(output)).toEqual(svgElementNames(original));
  });

  it('[SEC-001] keeps the embedded PNG and the internal references', async () => {
    // Arrange
    const png = place('png.svg', fixture('benign', 'embedded-png.svg'));
    // Act and assert: the embedded PNG, then the internal references
    await sanitizer.sanitize(png);
    expect(readFileSync(png, 'utf8')).toMatch(/xlink:href="data:image\/png;base64,iVBORw0KGgo[^"]+"/);
    const refs = place('refs.svg', fixture('benign', 'internal-references.svg'));
    await sanitizer.sanitize(refs);
    const output = readFileSync(refs, 'utf8');
    for (const kept of [
      'xlink:href="#base"',
      'fill:url(#tilted)',
      `fill="url('#dots')"`,
      'marker-end="url(#arrow)"',
    ]) {
      expect(output).toContain(kept);
    }
  });

  it('[SEC-001] refuses SVG files over 5 MB before reading them', async () => {
    const path = place(
      'big.svg',
      `<svg xmlns="http://www.w3.org/2000/svg"><!--${'x'.repeat(5 * 1024 * 1024)}--></svg>`,
    );
    const error = await sanitizer.sanitize(path).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RejectedUploadError);
    expect((error as RejectedUploadError).messageKey).toBe('upload.file.tooLarge');
    expect((error as RejectedUploadError).params).toEqual({ maxMb: 5 });
  });

  it('[SEC-001] refuses files that are not an SVG document at all', async () => {
    await expectRefused('<html><body><script>alert(1)</script></body></html>');
    await expectRefused('just text');
    await expectRefused('');
    await expectRefused('<svg xmlns="http://www.w3.org/2000/svg"/><svg xmlns="http://www.w3.org/2000/svg"/>');
    await expectRefused(
      Buffer.from('﻿<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf16le').toString('utf8'),
    );
  });

  it('[SEC-001] filter primitives, <use> and clobbering ids are lost (D-044, Lumi profile)', async () => {
    // WHY: Lumi's DOMPurify profile is "svg" without "svgFilters", DOMPurify drops <use>, and its DOM-clobbering
    // guard drops ids such as "title" that name document properties. This pins those documented losses; it is
    // why the corpus has no filter or <use> drawing (D-044).
    // Arrange
    const path = place(
      'loss.svg',
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><filter id="f"><feGaussianBlur stdDeviation="2"/></filter><rect id="r" width="1" height="1"/><linearGradient id="title"/></defs><use href="#r"/></svg>',
    );
    await sanitizer.sanitize(path); // Act
    // Assert
    expect(readFileSync(path, 'utf8')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><filter id="f"/><rect id="r" width="1" height="1"/><linearGradient/></defs></svg>',
    );
  });
});
