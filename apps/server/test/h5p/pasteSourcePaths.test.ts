/**
 * Unit tests of the paste-source path form `../<id>/<file>` that Lumi copies files from (D-092).
 *
 * Spec: PROD-007, SEC-008
 */
import { describe, expect, it } from 'vitest';
import {
  fitsLumiFilePattern,
  parsePasteSourcePath,
  pasteSourcePath,
} from '../../src/h5p/pasteSourcePaths.js';

const ID = '0192f0c4-0000-7000-8000-00000000c001';

describe('[PROD-007] paste-source paths', () => {
  it.each([
    [`../${ID}/images/diagram.png`, { sourceId: ID, file: 'images/diagram.png' }],
    [`../content/${ID}/videos/clip.webm`, { sourceId: ID, file: 'videos/clip.webm' }],
    // WHY: Lumi's pattern lets `..` through in both parts; the guard refuses these, the parser only reports them.
    ['../../etc/passwd', { sourceId: '..', file: 'etc/passwd' }],
    [`../${ID}/a/../b.png`, { sourceId: ID, file: 'a/../b.png' }],
  ])('[PROD-007] %s is a paste source', (path, expected) => {
    expect(parsePasteSourcePath(path)).toEqual(expected);
  });

  it.each([
    'images/diagram.png',
    `../${ID}/videos/klipp av hav æ.webm`,
    `../${ID}`,
    `/${ID}/images/diagram.png`,
    `https://example.org/${ID}/x.png`,
  ])('[PROD-007] %s is not one Lumi would copy', (path) => {
    expect(parsePasteSourcePath(path)).toBeUndefined();
  });

  it('[PROD-007] a written paste-source path reads back as the same source and file', () => {
    expect(parsePasteSourcePath(pasteSourcePath(ID, 'images/x-1a2B3c4D.png'))).toEqual({
      sourceId: ID,
      file: 'images/x-1a2B3c4D.png',
    });
  });

  it.each([
    ['images/diagram-1a2B3c4D.png', true],
    ['videos/clip.nn.vtt', true],
    ['videos/klipp av hav.webm', false],
    ['images/kjøkken.png', false],
    ['images/a+b.png', false],
  ])('[PROD-007] %s fits Lumi’s file-name pattern: %s', (name, fits) => {
    expect(fitsLumiFilePattern(name)).toBe(fits);
  });
});
