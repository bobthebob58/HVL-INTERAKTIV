/**
 * Tests for the studio content entry point: the real content/ loads frozen with every section; a broken folder gives
 * one error listing every problem in every file, ordered by file and line.
 *
 * Spec: PED-001
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import { StudioContentError } from '../../../src/learningDesign/content/StudioContentError.js';

const FIXTURES = fileURLToPath(new URL('../../fixtures/studio-content/', import.meta.url));
const SHOWN = 'apps/server/test/fixtures/studio-content';

const errorOf = (root: string): StudioContentError => {
  try {
    loadStudioContent(root);
  } catch (error) {
    if (error instanceof StudioContentError) return error;
    throw error;
  }
  throw new Error(`expected ${root} to be refused`);
};

describe('[PED-001] loadStudioContent', () => {
  it('[PED-001] loads the real content/ into one frozen object with a slot for every section', () => {
    // Act
    const content = loadStudioContent();
    // Assert
    expect(Object.keys(content)).toEqual(['phases', 'references', 'guide', 'patterns', 'mappe']);
    expect(Object.isFrozen(content)).toBe(true);
    expect(Object.isFrozen(content.phases.phases[0]?.label)).toBe(true);
    expect(Object.isFrozen(content.references.references)).toBe(true);
  });

  it('[PED-001] lists every problem of every file in one error, ordered by file and line', () => {
    // Arrange
    const folder = `${SHOWN}/problems-in-both-files/laeringsdesign`;
    const inPhasesOrReferences = (file: string) => /\/(phases|references)\.yaml$/.test(file);
    // Act
    const error = errorOf(join(FIXTURES, 'problems-in-both-files'));
    // Assert
    expect(error.problems.filter(({ file }) => inPhasesOrReferences(file))).toEqual([
      {
        file: `${folder}/phases.yaml`,
        line: 11,
        key: 'anchor.description.en',
        message: 'the en text is missing (every text needs nn, nb and en)',
      },
      {
        file: `${folder}/references.yaml`,
        line: 4,
        key: 'references.Guo2014',
        message: expect.stringMatching(/^is not a reference key/),
      },
      {
        file: `${folder}/references.yaml`,
        line: 7,
        key: 'references.szpunar2013.verify',
        message: 'is missing',
      },
    ]);
    expect(error.message).toMatch(/^The studio content has \d+ problems; the server does not start/);
    expect(error.message).toContain(
      `  - ${folder}/references.yaml:7: references.szpunar2013.verify: is missing\n`,
    );
  });

  it('[PED-001] reports a folder without the content files by naming each missing file', () => {
    // Act
    const error = errorOf(join(FIXTURES, 'no-such-folder'));
    // Assert
    expect(error.problems).toEqual(
      expect.arrayContaining([
        {
          file: `${SHOWN}/no-such-folder/laeringsdesign/phases.yaml`,
          message: 'cannot read the file (ENOENT)',
        },
        {
          file: `${SHOWN}/no-such-folder/laeringsdesign/references.yaml`,
          message: 'cannot read the file (ENOENT)',
        },
      ]),
    );
  });
});
