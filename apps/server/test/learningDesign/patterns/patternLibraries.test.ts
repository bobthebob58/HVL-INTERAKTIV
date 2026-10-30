/**
 * Unit tests for which libraries an activity from a pattern needs and how a missing one is told apart from other
 * failures, so creation answers 409 `hvl:pattern-unavailable` and never Lumi's 500 (D-085 amendment).
 *
 * Spec: PROD-001
 */
import { LibraryName, type ILibraryName } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import {
  installedSemanticsSource,
  librariesNamedIn,
  MissingPatternLibraryError,
  missingLibraries,
  type InstalledLibraryLookup,
} from '../../../src/learningDesign/patterns/patternLibraries.js';

const installed = new Set(['H5P.QuestionSet 1.21', 'H5P.MultiChoice 1.16']);
const uber = (library: ILibraryName) => LibraryName.toUberName(library, { useWhitespace: true });
const lookup = {
  libraryExists: async (library: ILibraryName) => installed.has(uber(library)),
  getSemantics: async () => [],
  getLanguage: async () => null,
} as unknown as InstalledLibraryLookup;

describe('[PROD-001] the libraries a pattern needs', () => {
  it('[PROD-001] lists the main library and every sub-content library once, in document order', () => {
    // Arrange
    const params = {
      questions: [
        {
          library: 'H5P.MultiChoice 1.16',
          params: { media: { type: { library: 'H5P.Image 1.1', params: {} } } },
        },
        { library: 'H5P.MultiChoice 1.16', params: {} },
        { library: 'not a library', params: {} },
      ],
    };
    // Act
    const named = librariesNamedIn(params, 'H5P.QuestionSet 1.21');
    // Assert
    expect(named).toEqual(['H5P.QuestionSet 1.21', 'H5P.MultiChoice 1.16', 'H5P.Image 1.1']);
  });

  it('[PROD-001] finds the ones that are not installed', async () => {
    const missing = await missingLibraries(['H5P.QuestionSet 1.21', 'H5P.Image 1.1'], lookup);
    expect(missing).toEqual(['H5P.Image 1.1']);
  });

  it('[PROD-001] refuses the semantics of a missing library with its own error, before Lumi reads it', async () => {
    // Arrange
    const source = installedSemanticsSource(lookup);
    // Act
    const reading = source.getSemantics(
      LibraryName.fromUberName('H5P.Summary 1.10', { useWhitespace: true }),
    );
    // Assert
    await expect(reading).rejects.toThrow(MissingPatternLibraryError);
    await expect(reading).rejects.toMatchObject({ library: 'H5P.Summary 1.10' });
    await expect(
      source.getSemantics(LibraryName.fromUberName('H5P.MultiChoice 1.16', { useWhitespace: true })),
    ).resolves.toEqual([]);
  });
});
