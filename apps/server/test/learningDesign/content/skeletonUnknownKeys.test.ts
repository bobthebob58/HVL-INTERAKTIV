/**
 * Tests for the content check's unknown-key rule on H5P's own storage shapes (./skeletonFieldWalk.ts): the keys H5P
 * writes beside the semantics (`subContentId` on a sub-content node and on a sub-content group, such as H5P.Summary's
 * statements) are allowed, and a group of one field is judged by that field, as H5P stores it. A stand-in catalogue
 * gives each shape on its own; the real libraries are covered by ./patternLibraryChecks.test.ts. The content of every
 * real example package passes as it was exported, since the ALU README makes skeletons from exported `.h5p` files.
 *
 * Spec: PROD-009, PED-010, PED-011
 */
import { describe, expect, it } from 'vitest';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import {
  readInstalledLibraries,
  type InstalledLibraryCatalogue,
} from '../../../src/learningDesign/content/installedLibraries.js';
import { walkSkeletonFields } from '../../../src/learningDesign/content/skeletonFieldWalk.js';
import { skeletonLibraryProblems } from '../../../src/learningDesign/content/skeletonLibraryChecks.js';
import { describeWithRealPackages, packageExamples } from '../../support/realPackages.js';

const MAIN = [
  {
    name: 'statements',
    type: 'list',
    field: {
      name: 'statement',
      type: 'group',
      isSubContent: true,
      fields: [
        { name: 'text', type: 'text' },
        { name: 'tip', type: 'text' },
      ],
    },
  },
  {
    name: 'behaviour',
    type: 'group',
    fields: [
      {
        name: 'switches',
        type: 'group',
        fields: [
          { name: 'enableRetry', type: 'boolean' },
          { name: 'enableSolutionsButton', type: 'boolean' },
        ],
      },
    ],
  },
  { name: 'task', type: 'library', options: ['H5P.Sub 1.0'] },
] as ISemanticsEntry[];

const SUB = [{ name: 'question', type: 'text' }] as ISemanticsEntry[];

const catalogue: InstalledLibraryCatalogue = {
  versionsOf: (name) => (name === 'H5P.Main' || name === 'H5P.Sub' ? [{ major: 1, minor: 0 }] : []),
  semanticsOf: (library) => ({ 'H5P.Main 1.0': MAIN, 'H5P.Sub 1.0': SUB })[library],
};

const problemsOf = (params: Record<string, unknown>) =>
  skeletonLibraryProblems(
    {
      value: { library: 'H5P.Main 1.0', metadataTitle: 'Tittel', params },
      file: 'skeleton.json',
      locate: (path: readonly (string | number)[]) => ({ key: path.join('.') }),
    },
    {},
    catalogue,
  ).map((problem) => problem.key);

describe('[PROD-009] keys H5P stores beside the semantics', () => {
  it('[PROD-009] allows subContentId on a sub-content node and on a sub-content group, and names a misspelt key there', () => {
    // Arrange
    const params = {
      statements: [
        { text: 'a', tip: 'b', subContentId: 'statement-1' },
        { text: 'a', tpi: 'b' },
      ],
      task: {
        library: 'H5P.Sub 1.0',
        params: { question: 'q' },
        metadata: { title: 't', license: 'U' },
        subContentId: 'task-1',
      },
    };
    // Act
    const keys = problemsOf(params);
    // Assert
    expect(keys).toEqual(['params.statements.1.tpi']);
  });

  it('[PROD-009] judges a group of one field by that field, as H5P stores it, and names a misspelt switch', () => {
    // Act
    const flattened = problemsOf({ behaviour: { enableRetry: true, enableSolutionButton: true } });
    const nested = problemsOf({ behaviour: { switches: { enableRetry: true } } });
    // Assert
    expect(flattened).toEqual(['params.behaviour.enableSolutionButton']);
    expect(nested).toEqual(['params.behaviour.switches']);
  });
});

describeWithRealPackages('[PED-011] skeletons made from exported .h5p files', () => {
  it('[PED-011] names no key in the content of any real example package, as the editors exported it', async () => {
    // Arrange
    const installed = readInstalledLibraries();
    if (installed.kind !== 'installed') throw new Error('the pinned libraries are not installed');
    const { catalogue } = installed;
    // Act
    const named = (await packageExamples()).flatMap(({ file, library, params }) => {
      const semantics = catalogue.semanticsOf(library);
      if (!semantics) return [`${file}: ${library} is not installed`];
      const { unknownKeys } = walkSkeletonFields(
        params as Record<string, unknown>,
        library,
        semantics,
        catalogue,
      );
      return unknownKeys.map((unknown) => `${file}: ${unknown.path.join('.')}`);
    });
    // Assert
    expect(named).toEqual([]);
  });
});
