/**
 * answerMarkup — reads the answers that H5P.Blanks and H5P.DragText write inside their text: each `*answer*` is a
 * blank or a drop zone, and the learner's saved state points at them by their order.
 *
 * Why: probe P3 (D-093) showed that both types restore the learner's input by position: Blanks keeps one string per
 *      blank, DragText the index of each word and drop zone. The structure signature therefore needs the list of
 *      blank solutions and of drop-zone and distractor words, read the way the players read them, without the tip
 *      (`:tip`) and the feedback (`\+…`, `\-…`) that may be reworded freely.
 * Spec: PROD-013
 * Invariants:
 *   - Blanks: as H5P.Blanks 1.14 `handleBlanks`/`parseSolution` (blanks.js:260, :735): pairs of `*`, tags removed,
 *     an empty pair is no blank, the solution ends at the first `:`, its alternatives are split at `/` and trimmed.
 *   - DragText: as H5P.DragText 1.10 `parseText`/`lex` (parse-text.js): line breaks become `<br/>` first, parts that
 *     start and end with `*` are answers, a tip and the two feedbacks are cut off; distractors count only as such
 *     parts.
 *   - Every text is compared as plain text (./subContentNodes.ts `plainTextOfValue`).
 * Collaborators: ./leafShapes.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/answerMarkup.test.ts
 */
import { plainTextOfValue } from './subContentNodes.js';

// WHY: as H5P.Blanks 1.14 does, which strips these tags inside a blank before reading it (blanks.js:270).
const BLANK_TAGS = /<\/?[a-z]*\d?>/gi;
const BLANK = /\*([^*]*)\*/g;
// WHY: H5P.DragText 1.10's tokenizer (parse-text.js:12), on the text with line breaks turned into `<br/>`.
const DRAG_TEXT_PARTS = /(\*.*?\*)/;
const LINE_BREAKS = /\r\n|\n|\r/g;
const DRAG_TIP = /(:([^\\*]+))/g;
const DRAG_CORRECT = /(\\\+([^\\*:]+))/g;
const DRAG_INCORRECT = /(\\-([^\\*:]+))/g;

/**
 * The solution of one blank, as H5P.Blanks compares the learner's answer with it.
 * @param content - The text between the two `*`, tags already removed.
 * @returns The alternatives, each as plain text, joined by `/`.
 */
function blankSolution(content: string): string {
  const tip = content.indexOf(':');
  const solution = tip === -1 ? content : content.slice(0, tip);
  return solution
    .split('/')
    .map((alternative) => plainTextOfValue(alternative))
    .join('/');
}

/**
 * The blanks of an H5P.Blanks activity, in the order the learner's state keeps them.
 * @param questions - The `questions` list (HTML strings); anything else has no blanks.
 * @returns One solution per blank, across all questions in order.
 */
export function blankSolutions(questions: unknown): string[] {
  const texts = Array.isArray(questions) ? questions.filter((q): q is string => typeof q === 'string') : [];
  return texts.flatMap((question) =>
    [...question.matchAll(BLANK)]
      .map((match) => (match[1] ?? '').replace(BLANK_TAGS, ''))
      .filter((content) => content.length > 0)
      .map(blankSolution),
  );
}

/** Removes the first occurrence of the matches as H5P.DragText's `lex` does (`text.replace(matches, '')`). */
const withoutMatches = (text: string, pattern: RegExp, source: string): string => {
  const matches = source.match(pattern);
  // WHY: `lex` passes the match array to `replace`, which joins it with commas; one match is removed as written.
  return matches ? text.replace(matches.join(','), '') : text;
};

/**
 * The word a learner drags for one `*answer*` part, as H5P.DragText's `lex` reads it.
 * @param part - A part that starts and ends with `*`.
 * @returns The word as plain text, without its tip and feedback.
 */
function dragTextWord(part: string): string {
  let text = part.slice(1, -1);
  text = withoutMatches(text, DRAG_TIP, part);
  text = withoutMatches(text, DRAG_CORRECT, part);
  text = withoutMatches(text, DRAG_INCORRECT, part);
  return plainTextOfValue(text.replace(/\s+$/, ''));
}

/**
 * The drop-zone words of a DragText text, or the words of its distractors, in the order the state indexes them.
 * @param text - `textField` or `distractors`; anything else has no words.
 * @returns One word per `*answer*` part, in order.
 */
export function dragTextWords(text: unknown): string[] {
  if (typeof text !== 'string') return [];
  return text
    .replace(LINE_BREAKS, '<br/>')
    .split(DRAG_TEXT_PARTS)
    .filter((part) => part.startsWith('*') && part.endsWith('*'))
    .map(dragTextWord);
}
