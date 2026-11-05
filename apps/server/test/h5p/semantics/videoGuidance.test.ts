/**
 * Tests for the editor's semantics hook: the DragQuestion filter still runs, the listed video fields get the English
 * guidance on a copy, and with the real texts the guidance reaches InteractiveVideo's and H5P.Video's upload fields.
 *
 * Spec: H5P-010, H5P-002
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LibraryName } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { resolveSemanticsPath } from '../../../src/h5p/languageOverlay/semanticsPath.js';
import { editorSemanticsHook } from '../../../src/h5p/semantics/videoGuidance.js';
import { removeDragQuestion } from '../../../src/h5p/semantics/removeDragQuestion.js';
import { loadLanguageOverlay } from '../../../src/learningDesign/content/h5pTextsContent.js';
import { PINNED_LIBRARIES_DIR } from '../../../src/learningDesign/content/installedLibraries.js';
import { describeWithRealPackages } from '../../support/realPackages.js';

const SEMANTICS = [
  { name: 'video', type: 'video', label: 'Video', description: 'Add a video.' },
  {
    name: 'task',
    type: 'library',
    label: 'Task',
    options: ['H5P.MultiChoice 1.16', 'H5P.DragQuestion 1.15'],
  },
] as ISemanticsEntry[];
const GUIDANCE = { fields: [{ library: 'H5P.Fixture 1.0', path: 'video' }], english: 'Use Panopto.' };

describe('[H5P-010] the editor semantics hook', () => {
  it('[H5P-010] sets the English guidance on a listed field and still removes DragQuestion', () => {
    // Arrange
    const before = structuredClone(SEMANTICS);
    // Act
    const altered = editorSemanticsHook(GUIDANCE)(new LibraryName('H5P.Fixture', 1, 0), SEMANTICS);
    // Assert
    expect(altered[0]?.description).toBe('Use Panopto.');
    expect(altered[1]?.options).toEqual(['H5P.MultiChoice 1.16']);
    expect(SEMANTICS).toEqual(before);
  });

  it('[H5P-010] leaves another library, another version or a path that names no field as the filter leaves it', () => {
    // Arrange
    const hook = editorSemanticsHook({
      ...GUIDANCE,
      fields: [...GUIDANCE.fields, { library: 'H5P.Other 1.0', path: 'nope' }],
    });
    // Act and assert
    for (const library of [new LibraryName('H5P.Fixture', 1, 1), new LibraryName('H5P.Other', 1, 0)])
      expect(hook(library, SEMANTICS)).toEqual(removeDragQuestion(library, SEMANTICS));
  });

  it('[H5P-002] without guidance the hook is the DragQuestion filter itself', () => {
    expect(editorSemanticsHook(undefined)).toBe(removeDragQuestion);
  });
});

describeWithRealPackages('[H5P-010] the guidance on the pinned video libraries', () => {
  const overlay = loadLanguageOverlay();
  const semanticsOf = (folder: string) =>
    JSON.parse(
      readFileSync(join(PINNED_LIBRARIES_DIR, folder, 'semantics.json'), 'utf8'),
    ) as ISemanticsEntry[];

  it.each([
    ['H5P.InteractiveVideo', 1, 28, 'interactiveVideo.video.files'],
    ['H5P.Video', 1, 6, 'sources'],
  ] as const)('[H5P-010] %s %i.%i shows the English guidance on %s', (name, major, minor, path) => {
    // Act
    const altered = editorSemanticsHook(overlay.videoGuidance)(
      new LibraryName(name, major, minor),
      semanticsOf(`${name}-${major}.${minor}`),
    );
    const field = resolveSemanticsPath(altered, path)?.field;
    // Assert
    expect(field?.type).toBe('video');
    expect(field?.description).toBe(overlay.videoGuidance?.english);
    expect(field?.description).toMatch(/Panopto.*50 MB.*\.vtt/s);
  });
});
