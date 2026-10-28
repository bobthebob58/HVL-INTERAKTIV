/**
 * Unit tests of the safe names a duplicate gives its own copies of files Lumi will not copy (D-092).
 *
 * Spec: PROD-007
 */
import { describe, expect, it } from 'vitest';
import { fitsLumiFilePattern } from '../../../src/h5p/pasteSourcePaths.js';
import { assertSafeObjectName } from '../../../src/h5p/storage/s3Objects.js';
import { copySuffix, safeCopyName } from '../../../src/learningDesign/collaboration/safeCopyName.js';

describe('[PROD-007] safe names for a duplicate’s own file copies', () => {
  it.each([
    ['videos/klipp av hav æ.webm', 'videos/klipp-av-hav-ae-ID.webm'],
    ['images/Kjøkken på Øya.PNG', 'images/Kjokken-pa-Oya-ID.PNG'],
    ['bilete/café (2).jpg', 'bilete/cafe-2-ID.jpg'],
    ['lyd/   .mp3', 'lyd/file-ID.mp3'],
    ['mappe med rom/fil', 'mappe-med-rom/fil-ID'],
    ['.skjult', 'skjult-ID'],
    ['dokument.tar gz', 'dokument-ID.targz'],
  ])('[PROD-007] %s becomes %s', (name, expected) => {
    expect(safeCopyName(name, 'ID')).toBe(expected);
  });

  it.each(['videos/klipp av hav æ.webm', 'a/../b c.png', './x y.png', '😀/🎥 film.webm', 'ÆØÅ/æøå.txt'])(
    '[PROD-007] %s gets a name Lumi copies and the storage accepts',
    (name) => {
      const safe = safeCopyName(name, copySuffix());
      expect(fitsLumiFilePattern(safe)).toBe(true);
      expect(assertSafeObjectName(safe)).toBe(safe);
    },
  );

  it('[PROD-007] the suffix is eight characters of Lumi’s ID alphabet and differs between calls', () => {
    const suffixes = new Set(Array.from({ length: 20 }, copySuffix));
    expect([...suffixes].every((s) => /^[0-9A-Za-z]{8}$/.test(s))).toBe(true);
    expect(suffixes.size).toBeGreaterThan(1);
  });
});
