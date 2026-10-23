/**
 * Tests for the CSP hashes of H5P Core's constant inline scripts, from source text and from the installed core.
 *
 * Spec: H5P-009, DATA-011
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coreInlineScriptHashes, inlineScriptHashes } from '../../../src/h5p/render/coreInlineScripts.js';

const sha = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
const CORE = resolve(import.meta.dirname, '../../../h5p/core');

describe('[DATA-011] H5P Core inline-script hashes', () => {
  it('[H5P-009] hashes the exact text of each distinct inline-script literal, once', () => {
    const source = `a = '<script>X = 1;</script>'; b = '<script>X = 1;</script>'; c = '<script>Y</script>';`;
    expect(inlineScriptHashes(source)).toEqual([sha('X = 1;'), sha('Y')]);
  });

  it('[DATA-011] a core that writes no inline script is an error, not an empty policy', () => {
    expect(() => inlineScriptHashes("x = '<script src=a.js></script>';")).toThrow(/no inline script/);
  });

  it.skipIf(!existsSync(CORE))(
    '[H5P-009] the installed Core 1.28 writes exactly the iframe head script',
    () => {
      const expected =
        'H5PIntegration = window.parent.H5PIntegration; var H5P = H5P || {}; H5P.externalEmbed = false;';
      expect(coreInlineScriptHashes(CORE)).toEqual([sha(expected)]);
    },
  );
});
