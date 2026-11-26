/**
 * Unit tests of the ASCII-only lower-casing and trimming that identifiers get (D-142).
 *
 * Spec: AUTH-002, AUTH-005
 */
import { describe, expect, it } from 'vitest';
import { asciiLowerCase, trimAsciiBlanks } from '../../../src/auth/identity/asciiText.js';

const KELVIN = 'K';

describe('[AUTH-002] ASCII-only folding of identifiers', () => {
  it('[AUTH-002] lower-cases A–Z and leaves every other character as written', () => {
    // Act + Assert
    expect(asciiLowerCase('Ola.NORDMANN@HVL.no')).toBe('ola.nordmann@hvl.no');
    expect(asciiLowerCase(`${KELVIN}ARI`)).toBe(`${KELVIN}ari`);
    expect(asciiLowerCase('ÅSE İ ẞ Σ')).toBe('Åse İ ẞ Σ');
    expect(asciiLowerCase('@[`{ 09_-')).toBe('@[`{ 09_-');
    expect(asciiLowerCase('')).toBe('');
  });

  it('[AUTH-002] differs from Unicode lower-casing exactly where a look-alike would become a plain letter', () => {
    // Act + Assert: what `toLowerCase` does, and this rule does not
    expect(`${KELVIN}ari`.toLowerCase()).toBe('kari');
    expect(asciiLowerCase(`${KELVIN}ari`)).not.toBe('kari');
    expect(asciiLowerCase(`${KELVIN}ari`)).toHaveLength(4);
  });

  it('[AUTH-005] trims spaces and tabs only: a no-break space, a line break or a byte-order mark stays', () => {
    // Act + Assert
    expect(trimAsciiBlanks(' \t ola@hvl.no\t ')).toBe('ola@hvl.no');
    for (const kept of [' ', '\n', '\r', '﻿', ' ', '　']) {
      expect(trimAsciiBlanks(`${kept}ola@hvl.no${kept}`)).toBe(`${kept}ola@hvl.no${kept}`);
    }
    expect(trimAsciiBlanks(' \t ')).toBe('');
    expect(trimAsciiBlanks('a b')).toBe('a b');
  });

  it('[AUTH-002] takes time in step with the length', () => {
    // Arrange
    const long = ` ${'A '.repeat(200_000)}`;
    // Act
    const started = performance.now();
    const folded = asciiLowerCase(trimAsciiBlanks(long));
    // Assert
    expect(folded).toHaveLength(399_999);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
