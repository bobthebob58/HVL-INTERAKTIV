/**
 * gapSolutions — reads the gaps of a Blanks or DragText task from its parameters: for each gap, in order, the answers
 * the author accepts, as plain text; and normalises a learner's gap answer the way insight groups answers.
 *
 * Why: INS-003 shows the most frequent wrong answers per gap. A stored `fill-in` response says what the learner wrote
 *      in each gap (joined by `[,]`, DATA-012) but not which gaps were right, so the gap's accepted answers come from
 *      the teacher's own parameters, parsed as the libraries parse them.
 * Spec: INS-003
 * Invariants:
 *   - Blanks: a gap is the text between two `*` in a line of `questions` (H5P.Blanks 1.14 `handleBlanks`: `**` is
 *     no gap); simple tags inside it are removed, the tip after the first `:` is dropped, and `/` separates the
 *     accepted alternatives. DragText: a gap is a part of `textField` split on `/(\*.*?\*)/` (H5P.DragText 1.10
 *     `parseText`), without its tip (`:…`) and feedback (`\+…`, `\-…`). Gaps are numbered in document order, as the
 *     libraries number the parts of their `[,]` response.
 *   - Accepted answers are plain text (entities decoded, whitespace collapsed); an empty alternative is dropped.
 *   - `normaliseGapAnswer` trims, collapses inner whitespace, composes Unicode (NFC) and, unless told the task is
 *     case-sensitive, folds case (INS-003: "trimmed, case-folded").
 *   - Never throws on author data: a field of the wrong type reads as no gaps.
 * Collaborators: ../../learningDesign/safeEditing/subContentNodes.ts (readers), ./questionCatalogue.ts,
 *   ../aggregate/gapMisconceptions.ts.
 * Tests: apps/server/test/insight/questionCatalogue.test.ts
 */
import { listOf, plainTextOfValue } from '../../learningDesign/safeEditing/subContentNodes.js';

/** One gap: the answers the author accepts, as plain text. */
export interface GapSolution {
  readonly answers: readonly string[];
}

const acceptedAnswers = (alternatives: readonly string[]): GapSolution => ({
  answers: alternatives.map((answer) => plainTextOfValue(answer)).filter((answer) => answer !== ''),
});

/**
 * The gap contents of one Blanks line, as H5P.Blanks 1.14 finds them.
 * @param line - One `questions` entry (HTML).
 * @returns The text between each pair of `*`, without simple tags; `**` gives none.
 */
function blanksClozes(line: string): string[] {
  const clozes: string[] = [];
  let start = line.indexOf('*');
  while (start !== -1) {
    const end = line.indexOf('*', start + 1);
    if (end === -1) break;
    // WHY: the same tag removal as H5P.Blanks 1.14 `handleBlanks`, so the gaps are numbered as the library numbers them.
    const content = line.slice(start + 1, end).replaceAll(/<\/?[a-z]*\d?>/gi, '');
    if (content.length > 0) clozes.push(content);
    start = line.indexOf('*', end + 1);
  }
  return clozes;
}

/**
 * The gaps of a Blanks task.
 * @param params - The H5P.Blanks parameters.
 * @returns One entry per gap, across all lines, in order.
 * @spec INS-003
 */
export function blanksGaps(params: Record<string, unknown>): GapSolution[] {
  return listOf(params.questions)
    .filter((line): line is string => typeof line === 'string')
    .flatMap(blanksClozes)
    .map((cloze) => {
      const colon = cloze.indexOf(':');
      return acceptedAnswers((colon === -1 ? cloze : cloze.slice(0, colon)).split('/'));
    });
}

/**
 * The gaps (drop zones) of a DragText task.
 * @param params - The H5P.DragText parameters.
 * @returns One entry per drop zone, in order.
 * @spec INS-003
 */
export function dragTextGaps(params: Record<string, unknown>): GapSolution[] {
  const text = typeof params.textField === 'string' ? params.textField : '';
  return text
    .split(/(\*.*?\*)/)
    .filter((part) => part.length >= 2 && part.startsWith('*') && part.endsWith('*'))
    .map((part) => {
      // WHY: as H5P.DragText 1.10 `lex`: the tip (`:…`) and the feedback (`\+…`, `\-…`) are not part of the answer.
      const solution = part
        .slice(1, -1)
        .replace(/:[^*]*$/, '')
        .replaceAll(/\\[+-][^*:]*/g, '')
        .trimEnd();
      return acceptedAnswers([solution]);
    });
}

/**
 * A learner's gap answer as insight compares and groups it.
 * @param answer - What the learner wrote or dropped.
 * @param caseSensitive - Whether the task tells upper and lower case apart (Blanks' `behaviour.caseSensitive`).
 * @returns The trimmed answer with collapsed whitespace, in NFC, case-folded unless case-sensitive.
 * @spec INS-003
 */
export function normaliseGapAnswer(answer: string, caseSensitive = false): string {
  const trimmed = answer.normalize('NFC').replaceAll(/\s+/g, ' ').trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}
