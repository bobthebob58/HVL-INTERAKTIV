/**
 * HvlTop10ContentTypeFilter — authors can create exactly the ten content types HVL supports.
 *
 * Why: the ten types were chosen for pedagogy and universal design (spec 01 §3, D-006). Other installed
 *      libraries stay as dependencies but must never appear as something an author can create, and content
 *      whose main library is not one of the ten must not be saved (`H5P-002`, `PROD-002`).
 * Spec: H5P-002, PROD-002
 * Invariants:
 *   - `HVL_TOP10_CONTENT_TYPES` is the single list; a test compares it with the table in spec 01 §3.
 *   - The editor's content-type list holds only installed members of the list, none installable or updatable
 *     from the Hub (library changes go through the audited install path, D-041).
 * Collaborators: ./HvlH5PEditor.ts (applies both rules), ./semantics/removeDragQuestion.ts.
 * Tests: apps/server/test/h5p/HvlTop10ContentTypeFilter.test.ts
 */
import { H5pError, LibraryName } from '@lumieducation/h5p-server';
import type { IHubInfo } from '@lumieducation/h5p-server/build/src/types.js';

/**
 * The ten content types authors can create, by machine name.
 * @see docs/specs/01-h5p-core128.md §3 "The ten content types" — change both together, with a decision.
 */
export const HVL_TOP10_CONTENT_TYPES: readonly string[] = Object.freeze([
  'H5P.CoursePresentation',
  'H5P.InteractiveVideo',
  'H5P.QuestionSet',
  'H5P.InteractiveBook',
  'H5P.Column',
  'H5P.DragText',
  'H5P.MultiChoice',
  'H5P.Blanks',
  'H5P.ImageHotspots',
  'H5P.BranchingScenario',
]);

const AUTHORABLE = new Set(HVL_TOP10_CONTENT_TYPES);

/**
 * Tells whether authors may create content of this type.
 * @param machineName - e.g. `H5P.MultiChoice`.
 * @returns True for the ten types only.
 */
export const isAuthorableType = (machineName: string): boolean => AUTHORABLE.has(machineName);

/**
 * Narrows the editor's content-type list (the Hub client's "content-type-cache" answer) to the ten types.
 * @param info - Lumi's list, built from the cached Hub list and the installed libraries.
 * @returns The same structure with only installed members of the ten, none installable or updatable.
 */
export function filterContentTypeCache(info: IHubInfo): IHubInfo {
  const libraries = info.libraries
    .filter((type) => type.installed && isAuthorableType(type.machineName))
    // SECURITY: no "install" or "update" button; libraries change only through the audited path (D-041).
    .map((type) => ({ ...type, canInstall: false, isUpToDate: true, restricted: false }));
  return { ...info, libraries, outdated: false };
}

/**
 * Refuses a main library outside the ten, as content saves and package imports require.
 * @param ubername - Main library as the editor sends it, e.g. `H5P.MultiChoice 1.16`.
 * @throws H5pError `hvl:content-type-not-allowed` (HTTP 403) for any other type, or
 *   `invalid-main-library-name` (HTTP 400) when the name cannot be parsed.
 */
export function assertAuthorableMainLibrary(ubername: string): void {
  let machineName: string;
  try {
    machineName = LibraryName.fromUberName(ubername, { useWhitespace: true }).machineName;
  } catch {
    throw new H5pError('invalid-main-library-name', { name: ubername }, 400);
  }
  if (!isAuthorableType(machineName)) {
    throw new H5pError('hvl:content-type-not-allowed', { library: machineName }, 403);
  }
}
