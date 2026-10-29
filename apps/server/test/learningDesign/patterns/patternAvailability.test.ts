/**
 * Unit tests of a pattern's availability when a library is installed but its skeleton cannot be built (D-085
 * amendment 2026-10-29, S5 review): the pattern is unavailable instead of an error that fails the whole overview, the
 * cause is logged once per pattern and content type until a build succeeds again, and a missing library is
 * unavailable without a log.
 *
 * Spec: PED-001, PROD-001
 */
import type { ILibraryName } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import {
  PatternCreator,
  type PatternCreatorDeps,
} from '../../../src/learningDesign/patterns/PatternCreator.js';

const patterns = loadStudioContent().patterns;
const [first] = patterns.patterns;

/** A creator whose installed libraries all fail to give their semantics while `broken.now` is true. */
function creatorWithLibraries(installed: boolean) {
  const broken = { now: true };
  const warnings: unknown[] = [];
  const libraryManager = {
    libraryExists: async () => installed,
    getSemantics: async (library: ILibraryName) => {
      if (broken.now) throw new SyntaxError(`Unexpected token in ${library.machineName}/semantics.json`);
      return [];
    },
    getLanguage: async () => null,
  };
  const deps = {
    db: {},
    editor: { libraryManager },
    patterns,
    log: { warn: (...args: unknown[]) => void warnings.push(args[0]) },
  } as unknown as PatternCreatorDeps;
  return { creator: new PatternCreator(deps), broken, warnings };
}

describe('[PED-001] a pattern whose library cannot be read', () => {
  it('[PED-001] is unavailable, never an error, and its cause is logged once per pattern and content type', async () => {
    // Arrange
    if (!first) throw new Error('no pattern in content/');
    const { creator, warnings } = creatorWithLibraries(true);
    // Act
    const answers = [await creator.availability(first.id), await creator.availability(first.id)];
    // Assert
    expect(answers.map((answer) => answer?.available)).toEqual([false, false]);
    expect(warnings).toEqual(
      first.skeletons.map((skeleton) => ({
        patternId: first.id,
        contentType: skeleton.contentType,
        errorName: 'SyntaxError',
      })),
    );
  });

  it('[PED-001] is logged again when it fails after a build succeeded', async () => {
    // Arrange
    if (!first) throw new Error('no pattern in content/');
    const { creator, broken, warnings } = creatorWithLibraries(true);
    await creator.availability(first.id);
    broken.now = false;
    await creator.availability(first.id).catch(() => undefined);
    broken.now = true;
    // Act
    await creator.availability(first.id);
    // Assert
    expect(warnings).toHaveLength(2 * first.skeletons.length);
  });

  it('[PROD-001] a library that is not installed makes the pattern unavailable without a log', async () => {
    // Arrange
    if (!first) throw new Error('no pattern in content/');
    const { creator, warnings } = creatorWithLibraries(false);
    // Act
    const answer = await creator.availability(first.id);
    // Assert
    expect([answer?.available, warnings]).toEqual([false, []]);
  });
});
