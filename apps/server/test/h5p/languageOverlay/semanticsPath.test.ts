/**
 * Tests for semanticsPath: a field named by its path is found with the positions a language file uses, through
 * groups and list items, and a path that names no field is undefined.
 *
 * Spec: H5P-008
 */
import { describe, expect, it } from 'vitest';
import { resolveSemanticsPath, SEMANTICS_PATH } from '../../../src/h5p/languageOverlay/semanticsPath.js';
import { FIXTURE_SEMANTICS } from './overlayFixtures.js';

describe('[H5P-008] semantics paths', () => {
  it.each([
    ['question', 'question', [{ index: 0, item: false }]],
    [
      'UI.submit',
      'submit',
      [
        { index: 1, item: false },
        { index: 1, item: false },
      ],
    ],
    [
      'steps[].proceed',
      'proceed',
      [
        { index: 2, item: true },
        { index: 1, item: false },
      ],
    ],
    ['tags[]', 'tag', [{ index: 4, item: true }]],
    ['video', 'video', [{ index: 3, item: false }]],
  ])('[H5P-008] finds %s with its positions', (path, name, steps) => {
    // Act
    const found = resolveSemanticsPath(FIXTURE_SEMANTICS, path);
    // Assert
    expect(found?.field.name).toBe(name);
    expect(found?.steps).toEqual(steps);
  });

  it.each([
    ['a field that does not exist', 'answer'],
    ['a field under a text field', 'question.label'],
    ['a list item of a group', 'UI[].check'],
    ['a list without [] before its item fields', 'steps.proceed'],
    ['the list item field written by its own name', 'steps[].step.proceed'],
    ['an empty segment', 'UI..check'],
    ['a prototype key', '__proto__'],
    ['not a path at all', 'UI check'],
  ])('[H5P-008] names no field for %s', (_case, path) => {
    expect(resolveSemanticsPath(FIXTURE_SEMANTICS, path)).toBeUndefined();
  });

  it('[H5P-008] the path shape accepts the names probe P1 reports and refuses others', () => {
    // Assert
    expect(
      ['UI.a11yCheck', 'branchingScenario.content[].proceedButtonText', 'tags[]', 'a-b_c'].every((path) =>
        SEMANTICS_PATH.test(path),
      ),
    ).toBe(true);
    expect(['', '.UI', 'UI.', 'UI[0]', 'U I', '1UI'].some((path) => SEMANTICS_PATH.test(path))).toBe(false);
  });
});
