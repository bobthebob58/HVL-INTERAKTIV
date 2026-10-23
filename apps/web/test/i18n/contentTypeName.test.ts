/**
 * Tests for content type names: the ten authorable types have names in nn, nb and en; others show their machine name.
 *
 * Spec: H5P-002, PROD-012
 */
import { describe, expect, it } from 'vitest';
import { AUTHORABLE_TYPES, contentTypeName } from '../../src/i18n/contentTypeName';

describe('[H5P-002] content type names', () => {
  it('[H5P-002] names exactly the ten authorable types, never DragQuestion', () => {
    expect(AUTHORABLE_TYPES).toHaveLength(10);
    expect(AUTHORABLE_TYPES).not.toContain('DragQuestion');
  });

  it.each(['nn', 'nb', 'en'] as const)('[PROD-012] every authorable type has a name in %s', (locale) => {
    for (const type of AUTHORABLE_TYPES) {
      const name = contentTypeName(`H5P.${type}`, locale);
      expect(name).not.toMatch(/^contentType\./);
      expect(name.length).toBeGreaterThan(2);
    }
  });

  it('[PROD-012] translates a known type and shows any other machine name readably', () => {
    expect(contentTypeName('H5P.MultiChoice', 'nn')).toBe('Fleirval');
    expect(contentTypeName('H5P.MultiChoice', 'en')).toBe('Multiple Choice');
    expect(contentTypeName('H5P.TrueFalse', 'nn')).toBe('TrueFalse');
  });
});
