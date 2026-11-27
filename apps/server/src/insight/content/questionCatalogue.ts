/**
 * questionCatalogue — finds every question in an activity's parameters, at any depth, with the ID its statements
 * carry: the activity itself when it is a single question, and each answerable sub-content node by `subContentId`.
 *
 * Why: INS-002, INS-003 and INS-005 report per question (sub-content) and show the question text from the activity's
 *      own parameters. H5P nests sub-content as `{ library: "H5P.Name 1.2", params, subContentId }` inside lists and
 *      groups of other sub-content (CLAUDE.md §5), so the walk is recursive and finds nodes by shape, as
 *      ../../learningDesign/patterns/subContentIds.ts does.
 * Spec: INS-002, INS-003, INS-005
 * Invariants:
 *   - A question is a node of a library that sends `answered` (`ANSWERABLE_LIBRARIES`; an H5P.Summary only with at
 *     least one statement set) with a non-empty string `subContentId`; the first node with an ID wins, so a
 *     duplicated ID is one question. When the main library is itself answerable (MultiChoice, Blanks, DragText),
 *     the activity is the question with item null, matching the stored root `answered` (no `subContentId`, D-115).
 *   - An H5P.SingleChoiceSet is the exception: its statements name its questions, never the set, so each of its
 *     questions with an ID is a question and the set itself is none (./questionShapes.ts `singleChoiceQuestions`,
 *     D-151). A row for the set would never get a learner.
 *   - Document order is kept: it is the order of the activity, and the tie-break when items sort equal.
 *   - The parameters are author data: the walk never throws, follows at most 100 levels, and never changes them.
 * Collaborators: ./questionShapes.ts, ../../learningDesign/safeEditing/subContentNodes.ts, ../InsightService.ts,
 *   ../aggregate/*.
 * Tests: apps/server/test/insight/questionCatalogue.test.ts
 */
import {
  isObject,
  isSubContentNode,
  libraryKey,
  listOf,
  machineNameOf,
  objectOf,
} from '../../learningDesign/safeEditing/subContentNodes.js';
import { questionShape, questionText, singleChoiceQuestions, type QuestionShape } from './questionShapes.js';

/** The libraries reachable inside the ten types that send `answered` (H5P's question types). */
export const ANSWERABLE_LIBRARIES: ReadonlySet<string> = new Set([
  'H5P.Blanks',
  'H5P.DragText',
  'H5P.Essay',
  'H5P.FreeTextQuestion',
  'H5P.ImageHotspotQuestion',
  'H5P.MarkTheWords',
  'H5P.MultiChoice',
  'H5P.MultiMediaChoice',
  'H5P.SingleChoiceSet',
  'H5P.Summary',
  'H5P.TrueFalse',
]);

// WHY: content.json nests about 15 levels; a bound keeps malformed parameters from exhausting the stack.
const MAX_DEPTH = 100;

/** One question of the activity. */
export interface CatalogueQuestion {
  /** The `subContentId` its statements carry, or null for the activity itself. */
  readonly item: string | null;
  /** The library's machine name, e.g. `H5P.MultiChoice`. */
  readonly library: string;
  /** The question text as plain text, or '' when the parameters hold none. */
  readonly text: string;
  readonly shape: QuestionShape;
}

/**
 * The entry of one question.
 * @param item - Its ID.
 * @param library - Its machine name.
 * @param params - Its parameters.
 * @returns The catalogue entry.
 */
export const catalogueQuestion = (
  item: string | null,
  library: string,
  params: Record<string, unknown>,
): CatalogueQuestion => ({
  item,
  library,
  text: questionText(library, params),
  shape: questionShape(library, params),
});

/**
 * Tells whether a node is a question a learner can answer.
 * @param library - Its machine name.
 * @param params - Its parameters.
 * @returns True for an answerable library; an H5P.Summary only with statements (InteractiveVideo's default is empty).
 */
export const isQuestion = (library: string, params: Record<string, unknown>): boolean =>
  ANSWERABLE_LIBRARIES.has(library) && (library !== 'H5P.Summary' || listOf(params.summaries).length > 0);

/**
 * The questions one node is.
 * @param library - Its machine name.
 * @param id - Its `subContentId`; null for the activity itself; undefined for a node without one.
 * @param params - Its parameters.
 * @returns The node itself for a question type with an ID; each question of an H5P.SingleChoiceSet; else none.
 */
function questionsOf(
  library: string,
  id: string | null | undefined,
  params: Record<string, unknown>,
): CatalogueQuestion[] {
  if (library === 'H5P.SingleChoiceSet')
    return singleChoiceQuestions(params).map((question) => ({ ...question, library }));
  return id !== undefined && isQuestion(library, params) ? [catalogueQuestion(id, library, params)] : [];
}

/** Adds the questions that are not known yet, so the first one with an ID wins. */
function add(found: Map<string | null, CatalogueQuestion>, questions: readonly CatalogueQuestion[]): void {
  for (const question of questions) if (!found.has(question.item)) found.set(question.item, question);
}

function collect(value: unknown, depth: number, found: Map<string | null, CatalogueQuestion>): void {
  if (depth > MAX_DEPTH) return;
  if (Array.isArray(value)) {
    for (const entry of value) collect(entry, depth + 1, found);
    return;
  }
  if (!isObject(value)) return;
  if (isSubContentNode(value)) {
    const id = value.subContentId;
    const own = typeof id === 'string' && id !== '' ? id : undefined;
    add(found, questionsOf(machineNameOf(libraryKey(value.library)), own, objectOf(value.params)));
  }
  for (const child of Object.values(value)) collect(child, depth + 1, found);
}

/**
 * Lists an activity's questions.
 * @param mainLibrary - The main library's machine name, e.g. `H5P.QuestionSet`.
 * @param params - The activity's parameters (content.json).
 * @returns The questions in document order; the activity itself first when it is a single question.
 * @spec INS-002
 */
export function questionCatalogue(mainLibrary: string, params: unknown): CatalogueQuestion[] {
  const root = objectOf(params);
  const found = new Map<string | null, CatalogueQuestion>();
  add(found, questionsOf(mainLibrary, null, root));
  collect(root, 0, found);
  return [...found.values()];
}
