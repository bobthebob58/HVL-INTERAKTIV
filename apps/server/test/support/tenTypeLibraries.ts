/**
 * tenTypeLibraries — synthetic stand-ins for the ten content types plus two that must stay unauthorable.
 *
 * Why: the HTTP tests need installed libraries with realistic semantics (text, lists, images, sub-content)
 *      without the real Hub packages (blocked until Step 14). H5P.TrueFalse and H5P.DragQuestion are installed
 *      too, so the tests can show they are never offered or accepted.
 * Spec: H5P-002, PROD-002, SEC-008
 * Tests: shared by apps/server/test/http/*.int.test.ts.
 */
import { HVL_TOP10_CONTENT_TYPES } from '../../src/h5p/HvlTop10ContentTypeFilter.js';
import type { SyntheticLibrary } from './syntheticLibraries.js';

/** H5P.MultiChoice with text, list, image and file fields, and an SVG among its library files. */
export const MULTI_CHOICE: SyntheticLibrary = {
  machineName: 'H5P.MultiChoice',
  minorVersion: 16,
  runnable: true,
  semantics: [
    { name: 'question', type: 'text' },
    { name: 'answers', type: 'list', field: { name: 'answer', type: 'text' } },
    { name: 'media', type: 'image', optional: true },
    { name: 'attachment', type: 'file', optional: true },
  ],
  files: { 'images/icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>' },
};

/** H5P.QuestionSet with a list of sub-content (MultiChoice offered; DragQuestion removed by our hook). */
export const QUESTION_SET: SyntheticLibrary = {
  machineName: 'H5P.QuestionSet',
  minorVersion: 21,
  runnable: true,
  semantics: [
    {
      name: 'questions',
      type: 'list',
      field: { name: 'q', type: 'library', options: ['H5P.MultiChoice 1.16', 'H5P.DragQuestion 1.14'] },
    },
  ],
};

const PLAIN_TEN: SyntheticLibrary[] = HVL_TOP10_CONTENT_TYPES.filter(
  (name) => name !== MULTI_CHOICE.machineName && name !== QUESTION_SET.machineName,
).map((machineName) => ({ machineName, runnable: true, semantics: [{ name: 'text', type: 'text' }] }));

/** Installed but never authorable. */
export const NOT_AUTHORABLE: SyntheticLibrary[] = [
  { machineName: 'H5P.TrueFalse', minorVersion: 8, runnable: true, semantics: [{ name: 'q', type: 'text' }] },
  {
    machineName: 'H5P.DragQuestion',
    minorVersion: 14,
    runnable: true,
    semantics: [{ name: 'q', type: 'text' }],
  },
];

/** Every library the HTTP tests install. */
export const HTTP_TEST_LIBRARIES: SyntheticLibrary[] = [
  MULTI_CHOICE,
  QUESTION_SET,
  ...PLAIN_TEN,
  ...NOT_AUTHORABLE,
];
