/**
 * Tests that a `library` value is taken for a library and its version exactly when Lumi's pattern
 * `/.+ \d+\.\d+/` would take it, by a test that reads a long value in time that follows its length (D-126).
 *
 * Spec: H5P-002, SEC-005
 */
import { describe, expect, it } from 'vitest';
import { findLibraryReferences, namesLibraryVersion } from '../../../src/h5p/semantics/libraryReferences.js';

describe('[H5P-002] which library values Lumi collects', () => {
  it.each([
    ['H5P.MultiChoice 1.16', true],
    ['H5P.MultiChoice 1.16.4', true],
    ['x 1.2', true],
    ['two words 10.20 and more', true],
    ['  1.2', true],
    ['H5P.MultiChoice', false],
    ['H5P.MultiChoice 1', false],
    ['H5P.MultiChoice 1.', false],
    ['H5P.MultiChoice-1.16', false],
    [' 1.2', false],
    ['1.2', false],
    ['a\n 1.2', false],
    ['a  1.2', false],
    ['a\n b 1.2', true],
    ['', false],
  ])('[H5P-002] %j is a library and its version: %s', (value, expected) => {
    // Act
    const taken = namesLibraryVersion(value);
    // Assert
    expect(taken).toBe(expected);
  });

  it('[H5P-002] every such value is found, at any depth and under any key, with the object that holds it', () => {
    // Arrange
    const inner = { library: 'H5P.Image 1.1', params: {} };
    const params = { a: [{ b: inner }], library: 'no version', c: { library: 'H5P.Text 1.1' } };
    // Act
    const found = findLibraryReferences(params);
    // Assert
    expect(found.map((reference) => reference.library).sort()).toEqual(['H5P.Image 1.1', 'H5P.Text 1.1']);
    expect(found.some((reference) => reference.owner === inner)).toBe(true);
  });

  it('[SEC-005] a long value that names no version is read in time that follows its length', () => {
    // Arrange: 20 000 characters of words and whole numbers, with no dot after any number
    const value = 'a 1 '.repeat(5_000);
    // Act
    const started = performance.now();
    const taken = namesLibraryVersion(value);
    const elapsed = performance.now() - started;
    // Assert
    expect(taken).toBe(false);
    expect(elapsed).toBeLessThan(100);
  });
});
