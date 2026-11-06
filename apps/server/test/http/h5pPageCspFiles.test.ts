/**
 * Tests for the files origin in the H5P pages' policy: a player page names it in `img-src` and `media-src` and nowhere
 * else, before any outside media origin; the editor page and a same-origin set-up never name it (D-110 amendment of
 * 2026-11-05).
 *
 * Spec: SEC-004, DATA-011
 */
import { describe, expect, it } from 'vitest';
import { h5pPageCsp, type H5pPageCspSettings } from '../../src/http/h5pPageCsp.js';

const FILES = 'https://files.interaktiv.hvl.no';
const PANOPTO = 'https://hvl.cloud.panopto.eu';
const settings: H5pPageCspSettings = {
  scriptHashes: ["'sha256-abc='"],
  externalMediaOrigins: [PANOPTO],
  filesOrigin: FILES,
};
const directivesNaming = (policy: string, origin: string): string[] =>
  policy
    .split('; ')
    .filter((directive) => directive.split(' ').includes(origin))
    .map((directive) => directive.split(' ')[0] ?? '');

describe('[SEC-004] the files origin in the H5P page policy', () => {
  it('[SEC-004] a player page names the files origin in img-src and media-src only', () => {
    // Act
    const policy = h5pPageCsp(settings, ["'self'"], { playerFiles: true });
    // Assert
    expect(directivesNaming(policy, FILES)).toEqual(['img-src', 'media-src']);
    expect(policy).toContain(`img-src 'self' data: blob: ${FILES} ${PANOPTO}`);
    expect(policy).toContain(`media-src 'self' blob: ${FILES} ${PANOPTO}`);
    expect(directivesNaming(policy, PANOPTO)).toEqual(['img-src', 'media-src', 'frame-src']);
  });

  it('[SEC-004] the editor page never names it, and the outside media origins stay as they were', () => {
    // Act
    const editor = h5pPageCsp(settings, ["'self'"]);
    const without = h5pPageCsp({ ...settings, filesOrigin: undefined }, ["'self'"], { playerFiles: true });
    const empty = h5pPageCsp({ ...settings, filesOrigin: '' }, ["'self'"], { playerFiles: true });
    // Assert
    expect(directivesNaming(editor, FILES)).toEqual([]);
    expect(editor).toBe(without);
    expect(empty).toBe(without);
    expect(editor).toContain(`img-src 'self' data: blob: ${PANOPTO}`);
  });
});
