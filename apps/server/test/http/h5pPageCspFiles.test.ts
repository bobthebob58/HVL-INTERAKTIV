/**
 * Tests for the files origin in the H5P pages' policy: the player page and the editor page name it in `img-src` and
 * `media-src` and nowhere else, before any outside media origin; a same-origin set-up never names it (D-110
 * amendment of 2026-11-05, D-153).
 *
 * Spec: SEC-004, DATA-011
 */
import { describe, expect, it } from 'vitest';
import { h5pPageCsp, type H5pPageCspSettings } from '../../src/http/h5pPageCsp.js';

const FILES = 'https://files.interaktiv.hvl.no';
const PANOPTO = 'https://hvl.cloud.panopto.eu';
const settings: H5pPageCspSettings = {
  externalMediaOrigins: [PANOPTO],
  filesOrigin: FILES,
};
const directivesNaming = (policy: string, origin: string): string[] =>
  policy
    .split('; ')
    .filter((directive) => directive.split(' ').includes(origin))
    .map((directive) => directive.split(' ')[0] ?? '');

describe('[SEC-004] the files origin in the H5P page policy', () => {
  it.each([
    ['a player page', { player: true }],
    ['the editor page', {}],
  ])('[SEC-004] %s names the files origin in img-src and media-src only', (_what, page) => {
    // Act
    const policy = h5pPageCsp(settings, ["'self'"], page);
    // Assert
    expect(directivesNaming(policy, FILES)).toEqual(['img-src', 'media-src']);
    expect(policy).toContain(`img-src 'self' data: blob: ${FILES} ${PANOPTO}`);
    expect(policy).toContain(`media-src 'self' blob: ${FILES} ${PANOPTO}`);
    expect(directivesNaming(policy, PANOPTO)).toEqual(['img-src', 'media-src', 'frame-src']);
    // SECURITY: nothing from the files origin is fetched by script or runs as script (SEC-004).
    expect(policy).toContain("connect-src 'self';");
    expect(policy).toMatch(/script-src 'self'(;| https:\/\/developers\.panopto\.com)/);
  });

  it('[SEC-004] a same-origin set-up never names it, and the two pages differ in what they may frame alone', () => {
    // Act
    const editor = h5pPageCsp(settings, ["'self'"]);
    const player = h5pPageCsp(settings, ["'self'"], { player: true });
    const without = h5pPageCsp({ ...settings, filesOrigin: undefined }, ["'self'"], { player: true });
    const empty = h5pPageCsp({ ...settings, filesOrigin: '' }, ["'self'"], { player: true });
    // WHY: only the editor may frame our own origin (D-125).
    const exceptFrames = (policy: string) =>
      policy
        .split('; ')
        .filter((directive) => !directive.startsWith('frame-src '))
        .join('; ');
    // Assert
    expect(directivesNaming(without, FILES)).toEqual([]);
    expect(empty).toBe(without);
    expect(without).toContain(`img-src 'self' data: blob: ${PANOPTO}`);
    expect(exceptFrames(editor)).toBe(exceptFrames(player));
    expect(editor).not.toBe(player);
  });
});
