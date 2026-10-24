/**
 * contentKinds — what kind of H5P content a library is: a learner task (the learner answers something) or text
 * to read. Several hint rules count tasks and words by these lists.
 *
 * Why: "an interaction" in PED-H02, PED-H08 and PED-H10 means a check of understanding (retrieval practice), not a
 *      text box, an image or a link. The lists are by machine name, so every version of a library counts.
 * Spec: UD-020, PED-020
 * Invariants:
 *   - `machineNameOf` accepts `H5P.Name 1.2` (content.json) and `H5P.Name-1.2` (h5p.json/folder style) and
 *     returns `undefined` for anything else, so an odd `library` value is never mistaken for sub-content.
 *     `mainMachineNameOf` also accepts a bare `H5P.Name`, for the activity itself only.
 *   - A library in neither list is neither a task nor reading text (e.g. H5P.Image, H5P.Link, H5P.Column).
 *   - `isOlderThan` reads the version of a library string; without a version it assumes the current one.
 * Collaborators: ./contentWalker.ts, ./imageAltSources.ts, ./rules/videoInteractionGapHint.ts,
 *   ./rules/columnActivitiesHint.ts, ./rules/chapterInteractionHint.ts, ./rules/slideWordsHint.ts.
 * Tests: apps/server/test/validation/contentWalker.test.ts
 */

const LIBRARY = /^([A-Za-z][\w.]*)[ -](\d+)\.(\d+)$/;

/**
 * The machine name of a library string.
 * @param library - e.g. `H5P.MultiChoice 1.16`.
 * @returns e.g. `H5P.MultiChoice`, or `undefined` when the string is not a library reference.
 */
export function machineNameOf(library: string): string | undefined {
  return LIBRARY.exec(library.trim())?.[1];
}

/**
 * Tells whether a library string names a version older than the given one.
 * @param library - e.g. `H5P.QuestionSet 1.20`.
 * @param major - The major version to compare with.
 * @param minor - The minor version to compare with.
 * @returns True only when the version is known and below `major.minor`; a bare machine name is not older.
 */
export function isOlderThan(library: string, major: number, minor: number): boolean {
  const match = LIBRARY.exec(library.trim());
  if (!match) return false;
  const [own, ownMinor] = [Number(match[2]), Number(match[3])];
  return own < major || (own === major && ownMinor < minor);
}

const MACHINE_NAME = /^[A-Za-z][\w.]*$/;

/**
 * The machine name of the activity's main library, which may come without a version.
 * @param library - e.g. `H5P.MultiChoice 1.16`, `H5P.MultiChoice-1.16` or `H5P.MultiChoice`.
 * @returns e.g. `H5P.MultiChoice`, or `undefined` for anything else.
 */
export function mainMachineNameOf(library: string): string | undefined {
  // WHY: a stored activity whose metadata lacks the version still names its type; sub-content always has one.
  return machineNameOf(library) ?? (MACHINE_NAME.test(library.trim()) ? library.trim() : undefined);
}

// PEDAGOGY: a task is a content type where the learner answers or decides, i.e. retrieval practice
// (Roediger & Karpicke 2006); containers such as Interactive Video count, since they hold such tasks.
const LEARNER_TASKS: ReadonlySet<string> = new Set([
  'H5P.ArithmeticQuiz',
  'H5P.Blanks',
  'H5P.BranchingQuestion',
  'H5P.BranchingScenario',
  'H5P.CoursePresentation',
  'H5P.Crossword',
  'H5P.Dialogcards',
  'H5P.DocumentationTool',
  'H5P.DragQuestion',
  'H5P.DragText',
  'H5P.Essay',
  'H5P.FindTheWords',
  'H5P.Flashcards',
  'H5P.FreeTextQuestion',
  'H5P.GoToQuestion',
  'H5P.GuessTheAnswer',
  'H5P.ImageHotspotQuestion',
  'H5P.ImagePair',
  'H5P.ImageSequencing',
  'H5P.InteractiveVideo',
  'H5P.MarkTheWords',
  'H5P.MemoryGame',
  'H5P.MultiChoice',
  'H5P.MultiMediaChoice',
  'H5P.OpenEndedQuestion',
  'H5P.Questionnaire',
  'H5P.QuestionSet',
  'H5P.SingleChoiceSet',
  'H5P.SortParagraphs',
  'H5P.SpeakTheWords',
  'H5P.SpeakTheWordsSet',
  'H5P.Summary',
  'H5P.TrueFalse',
]);

/** Libraries whose `text` parameter is reading text (rich text that learners read). */
export const READING_TEXT_LIBRARIES: ReadonlySet<string> = new Set([
  'H5P.AdvancedText',
  'H5P.ContinuousText',
  'H5P.Text',
]);

/** Learner tasks that ask for a summary or a reflection, which PED-H03 accepts at the end of a video. */
export const REFLECTION_LIBRARIES: ReadonlySet<string> = new Set([
  'H5P.Essay',
  'H5P.FreeTextQuestion',
  'H5P.OpenEndedQuestion',
  'H5P.Questionnaire',
  'H5P.Summary',
]);

/**
 * Tells whether a library is a learner task.
 * @param machineName - e.g. `H5P.MultiChoice`; `undefined` is never a task.
 * @returns True for content types in which the learner answers or decides.
 */
export const isLearnerTask = (machineName: string | undefined): boolean =>
  machineName !== undefined && LEARNER_TASKS.has(machineName);
