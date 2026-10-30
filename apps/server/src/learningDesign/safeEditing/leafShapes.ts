/**
 * leafShapes — the answer shape of the question types whose learner state points at their options, blanks or
 * words by position: what a structural edit of each changes.
 *
 * Why: probe P3 (D-093) played each type with a saved answer after each kind of edit. MultiChoice restores options
 *      by index, Blanks one string per blank, DragText word and zone indices, a branching question the chosen
 *      alternative, and Summary its progress by statement group. So the number and order of these, and MultiChoice's
 *      single or multiple mode, are structural; rewording, feedback, tips, the answer key (while the mode stays) and
 *      shuffling are not, because the probe resumed them correctly.
 * Spec: PROD-013
 * Invariants:
 *   - `facts` are compared exactly; each list in `lists` is structural only if its length changes or one of its
 *     texts moves (./structuralChange.ts), so a text changed in place is not.
 *   - MultiChoice's mode is derived as H5P.MultiChoice 1.16 does (multichoice.js:129): `behaviour.type` `auto`
 *     (also when missing) is single exactly when one option is correct; otherwise `single` is single.
 *   - Texts are plain text (./subContentNodes.ts), so markup the editor re-serialises is no change.
 * Collaborators: ./answerMarkup.ts, ./subContentNodes.ts, ./nodeShapes.ts (dispatches by machine name).
 * Tests: apps/server/test/learningDesign/safeEditing/leafShapes.test.ts,
 *   apps/server/test/learningDesign/safeEditing/structuralChangeRealTypes.test.ts
 */
import { blankSolutions, dragTextWords } from './answerMarkup.js';
import { listOf, objectOf, plainTextOfValue } from './subContentNodes.js';

/** What a rule reads from a node's parameters; ./nodeShapes.ts serialises it. */
export interface ShapeFacts {
  /** Compared exactly (as canonical JSON). */
  readonly facts?: unknown;
  /** Lists of texts, compared by length and position. */
  readonly lists?: Readonly<Record<string, readonly string[]>>;
}

/** Reads the shape of one library's parameters. */
export type ShapeRule = (params: Record<string, unknown>) => ShapeFacts;

/**
 * Single or multiple choice, as the player decides it.
 * @param params - H5P.MultiChoice parameters.
 * @returns `single` (radio buttons) or `multi` (checkboxes).
 */
export function multiChoiceMode(params: Record<string, unknown>): 'single' | 'multi' {
  const type = objectOf(params.behaviour).type ?? 'auto';
  const correct = listOf(params.answers).filter((answer) => Boolean(objectOf(answer).correct)).length;
  if (type === 'auto') return correct === 1 ? 'single' : 'multi';
  return type === 'single' ? 'single' : 'multi';
}

const multiChoice: ShapeRule = (params) => ({
  facts: { mode: multiChoiceMode(params) },
  lists: { options: listOf(params.answers).map((answer) => plainTextOfValue(objectOf(answer).text)) },
});

const blanks: ShapeRule = (params) => ({ lists: { blanks: blankSolutions(params.questions) } });

const dragText: ShapeRule = (params) => ({
  lists: { dropZones: dragTextWords(params.textField), distractors: dragTextWords(params.distractors) },
});

// WHY: the alternatives' `nextContentId`s belong to the scenario's graph, which ./containerShapes.ts records.
const branchingQuestion: ShapeRule = (params) => ({
  lists: {
    alternatives: listOf(objectOf(params.branchingQuestion).alternatives).map((alternative) =>
      plainTextOfValue(objectOf(alternative).text),
    ),
  },
});

const summary: ShapeRule = (params) => ({ facts: { groups: listOf(params.summaries).length } });

/**
 * The leaf rules by machine name.
 * @spec PROD-013
 */
export const LEAF_SHAPE_RULES: Readonly<Record<string, ShapeRule>> = Object.freeze({
  'H5P.MultiChoice': multiChoice,
  'H5P.Blanks': blanks,
  'H5P.DragText': dragText,
  'H5P.BranchingQuestion': branchingQuestion,
  'H5P.Summary': summary,
});
