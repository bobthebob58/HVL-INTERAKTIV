/**
 * Unit tests for how a stored activity becomes the validator's input.
 *
 * Spec: PROD-003, UD-020
 */
import { describe, expect, it } from 'vitest';
import { mainLibraryUbername, storedValidationInput } from '../../src/content/storedContent.js';

describe('[PROD-003] the validator sees the stored activity', () => {
  it('[PROD-003] names the main library with the version from the stored dependencies', () => {
    // Arrange
    const metadata = {
      preloadedDependencies: [
        { machineName: 'H5P.Question', majorVersion: 1, minorVersion: 5 },
        { machineName: 'H5P.InteractiveVideo', majorVersion: 1, minorVersion: 28 },
      ],
    };
    // Act and assert
    expect(mainLibraryUbername('H5P.InteractiveVideo', metadata)).toBe('H5P.InteractiveVideo 1.28');
    expect(mainLibraryUbername('H5P.MultiChoice', metadata)).toBe('H5P.MultiChoice');
    expect(mainLibraryUbername('H5P.MultiChoice', null)).toBe('H5P.MultiChoice');
    expect(
      mainLibraryUbername('H5P.MultiChoice', {
        preloadedDependencies: [{ machineName: 'H5P.MultiChoice', majorVersion: '1', minorVersion: 16 }],
      }),
    ).toBe('H5P.MultiChoice');
  });

  it('[UD-020] passes the stored parameters, the metadata and the language through unchanged', () => {
    // Arrange
    const row = {
      id: '0192f0c4-0000-7000-8000-000000000001',
      mainLibrary: 'H5P.DragText',
      params: { textField: '*ord*' },
      metadata: { title: 'T', defaultLanguage: 'nn' },
      status: 'draft' as const,
      updatedAt: new Date(),
    };
    // Act
    const input = storedValidationInput(row, 'en');
    // Assert
    expect(input).toEqual({
      mainLibrary: 'H5P.DragText',
      params: row.params,
      metadata: row.metadata,
      locale: 'en',
    });
  });
});
