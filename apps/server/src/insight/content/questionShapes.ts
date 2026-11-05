/**
 * questionShapes — reads one question's parameters into what insight shows next to its numbers: the question text as
 * plain text, and for a choice question its options with the teacher's feedback, or for a gap task its gaps.
 *
 * Why: INS-002 shows "the question text next to each item so the teacher does not need to open the editor", and
 *      INS-003 shows "the teacher's own feedback text for each wrong option". Both come from the activity's
 *      parameters, per library, with the HTML stripped to plain text.
 * Spec: INS-002, INS-003
 * Invariants:
 *   - Every text is plain (tags removed, entities decoded, whitespace collapsed) and at most 300 characters (code
 *     points), cut with «…»; the parameters are author data and may hold any JSON type, so a field of the wrong
 *     type reads as empty and nothing here throws.
 *   - A choice question is H5P.MultiChoice: its options in stored order (H5P reports choices by that order, its
 *     `originalOrder`, also when it shuffles them), each with `correct` and, for a wrong option only, the option's
 *     `tipsAndFeedback.chosenFeedback` (null when empty).
 *   - A gap task is H5P.Blanks (case-sensitive unless `behaviour.caseSensitive` is false, the library's default)
 *     or H5P.DragText (dropped words are the author's own, so compared as written).
 *   - H5P.SingleChoiceSet and H5P.ImageHotspotQuestion keep their text below the top level; it is read from there,
 *     so such an item is not left without a name (WCAG 1.3.1, 2.4.6). A set is one item for all its questions, so
 *     its text is every question's, joined with « / », not the first one's alone (that would name the whole set's
 *     numbers after one question).
 * Collaborators: ./gapSolutions.ts, ./questionCatalogue.ts, ../../learningDesign/safeEditing/subContentNodes.ts.
 * Tests: apps/server/test/insight/questionCatalogue.test.ts
 */
import { listOf, objectOf, plainTextOfValue } from '../../learningDesign/safeEditing/subContentNodes.js';
import { blanksGaps, dragTextGaps, type GapSolution } from './gapSolutions.js';

/** The longest question, option or feedback text insight hands on, in code points. */
export const INSIGHT_TEXT_MAX = 300;

/** One option of a choice question. */
export interface ChoiceOptionText {
  readonly text: string;
  readonly correct: boolean;
  /** The teacher's feedback for choosing this wrong option; null for a right option or when there is none. */
  readonly feedback: string | null;
}

/** What insight can say about a question's answers. */
export type QuestionShape =
  | { readonly kind: 'choice'; readonly options: readonly ChoiceOptionText[] }
  | { readonly kind: 'gaps'; readonly gaps: readonly GapSolution[]; readonly caseSensitive: boolean }
  | { readonly kind: 'other' };

/**
 * Plain text, cut to the insight length.
 * @param value - Any parameter value.
 * @returns The plain text, at most 300 code points.
 */
export function insightText(value: unknown): string {
  const characters = Array.from(plainTextOfValue(value));
  return characters.length <= INSIGHT_TEXT_MAX
    ? characters.join('')
    : `${characters.slice(0, INSIGHT_TEXT_MAX - 1).join('')}…`;
}

// WHY: each library keeps its question in its own field; these are the fields of the installed versions' semantics.
const TEXT_FIELDS: Readonly<Record<string, string>> = {
  'H5P.MultiChoice': 'question',
  'H5P.TrueFalse': 'question',
  'H5P.FreeTextQuestion': 'question',
  'H5P.MultiMediaChoice': 'question',
  'H5P.Blanks': 'text',
  'H5P.DragText': 'taskDescription',
  'H5P.MarkTheWords': 'taskDescription',
  'H5P.Essay': 'taskDescription',
  'H5P.Summary': 'intro',
};
const FALLBACK_FIELDS = ['question', 'taskDescription', 'text', 'intro'];
// WHY: these libraries keep their question below the top level (SingleChoiceSet 1.11, ImageHotspotQuestion 1.8).
const NESTED_TEXT: Readonly<Record<string, (params: Record<string, unknown>) => unknown>> = {
  // WHY: joined as HTML before the text is made plain, so an entity in a question is decoded once, not twice.
  'H5P.SingleChoiceSet': (params) =>
    listOf(params.choices)
      .map((choice) => objectOf(choice).question)
      .filter((question) => plainTextOfValue(question) !== '')
      .join(' / '),
  'H5P.ImageHotspotQuestion': (params) =>
    objectOf(objectOf(params.imageHotspotQuestion).hotspotSettings).taskDescription,
};

/** A gap task's own text with each gap shown as «___», for a task whose description is empty. */
function gapText(machineName: string, params: Record<string, unknown>): unknown {
  const raw =
    machineName === 'H5P.Blanks'
      ? listOf(params.questions)
          .filter((line) => typeof line === 'string')
          .join(' ')
      : params.textField;
  return typeof raw === 'string' ? raw.replaceAll(/\*[^*]*\*/g, '___') : '';
}

/**
 * The question text of a question's parameters.
 * @param machineName - The library, e.g. `H5P.MultiChoice`.
 * @param params - Its parameters.
 * @returns Plain text, or '' when the parameters hold none.
 * @spec INS-002
 */
export function questionText(machineName: string, params: Record<string, unknown>): string {
  const nested = NESTED_TEXT[machineName];
  if (nested) return insightText(nested(params));
  const own = TEXT_FIELDS[machineName];
  const fields = own ? [own] : FALLBACK_FIELDS;
  const text = fields.map((field) => insightText(params[field])).find((found) => found !== '') ?? '';
  return text !== '' || own === undefined ? text : insightText(gapText(machineName, params));
}

/** The options of an H5P.MultiChoice. */
function choiceOptions(params: Record<string, unknown>): ChoiceOptionText[] {
  return listOf(params.answers).map((answer) => {
    const option = objectOf(answer);
    const correct = option.correct === true;
    const feedback = correct ? '' : insightText(objectOf(option.tipsAndFeedback).chosenFeedback);
    return { text: insightText(option.text), correct, feedback: feedback === '' ? null : feedback };
  });
}

/**
 * What insight can say about a question's answers.
 * @param machineName - The library, e.g. `H5P.Blanks`.
 * @param params - Its parameters.
 * @returns Its options, its gaps, or `other`.
 * @spec INS-003
 */
export function questionShape(machineName: string, params: Record<string, unknown>): QuestionShape {
  switch (machineName) {
    case 'H5P.MultiChoice':
      return { kind: 'choice', options: choiceOptions(params) };
    case 'H5P.Blanks':
      return {
        kind: 'gaps',
        gaps: blanksGaps(params),
        caseSensitive: objectOf(params.behaviour).caseSensitive !== false,
      };
    case 'H5P.DragText':
      return { kind: 'gaps', gaps: dragTextGaps(params), caseSensitive: true };
    default:
      return { kind: 'other' };
  }
}
