/**
 * statelessLibraries — the installed sub-content libraries that keep no learner state, so editing them is never a
 * structural change (only where they sit counts).
 *
 * Why: D-093 (amendment of probe P3): a library without `getCurrentState` saves nothing a learner could resume, so
 *      rewording a text block or replacing an image cannot break a resumed answer. Its position still counts,
 *      because the container around it (Column, CoursePresentation, InteractiveBook) keeps its children's states
 *      by position. Every other library is stateful; without a rule of its own (./leafShapes.ts,
 *      ./containerShapes.ts) any change of its parameters is structural, which errs on the safe side.
 * Spec: PROD-013
 * Invariants:
 *   - Listed by `Name major.minor`: a new version of a library is stateful until it is checked and added here.
 *   - Only libraries of the pinned packages (D-078, `var/h5p-real/packages`) are listed; a test reads each listed
 *     library's scripts from those packages and fails if one defines `getCurrentState`.
 * Collaborators: ./nodeShapes.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/statelessLibraries.test.ts
 */

/**
 * The libraries of the pinned packages whose scripts define no `getCurrentState` (checked against the packages).
 * @spec PROD-013
 */
export const STATELESS_LIBRARIES: ReadonlySet<string> = new Set([
  'H5P.AdvancedText 1.1',
  'H5P.AudioRecorder 1.0',
  'H5P.ContinuousText 1.2',
  'H5P.GoToQuestion 1.3',
  'H5P.IVHotspot 1.2',
  'H5P.Image 1.1',
  'H5P.ImageHotspots 1.10',
  'H5P.ImageHotspots 1.11',
  'H5P.Link 1.3',
  'H5P.Nil 1.0',
  'H5P.Shape 1.0',
  'H5P.Table 1.2',
  'H5P.Text 1.1',
  'H5P.TwitterUserFeed 1.0',
]);

/**
 * Tells whether a library keeps no learner state.
 * @param key - The library as `Name major.minor` (./subContentNodes.ts `libraryKey`).
 * @returns True only for a listed library and version.
 */
export const isStatelessLibrary = (key: string): boolean => STATELESS_LIBRARIES.has(key);
