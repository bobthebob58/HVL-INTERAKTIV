/**
 * learnerStateAfterEditEdits — the parameter shapes of the real content types that probe P3 edits, and small edit
 * helpers: copy a node with a fresh `subContentId`, swap, insert and remove list items.
 *
 * Why: probe P3 (PROD-013, D-093) compares a text-only edit with structural edits (add, remove, reorder) on each type.
 *      The edits must be plain parameter changes, as the H5P editor would save them, so the probe sees what a learner
 *      meets after a real author's edit.
 * Spec: PROD-013
 * Invariants: an edit never mutates the parameters it is given; every new sub-content node has a fresh UUID.
 * Collaborators: ./learnerStateAfterEditBench.ts.
 * Tests: ./learnerStateAfterEdit.browser.int.test.ts, ./learnerStateAfterEditComposite.browser.int.test.ts,
 *   ./learnerStateAfterEditNavigation.browser.int.test.ts, ./learnerStateAfterEditPaths.browser.int.test.ts
 */
import { randomUUID } from 'node:crypto';

/** A sub-content node as H5P nests it in the parameters. */
export interface SubContent<P = Record<string, unknown>> {
  library: string;
  subContentId: string;
  params: P;
  metadata?: Record<string, unknown>;
}

/** H5P.MultiChoice parameters (the parts the probe edits). */
export interface MultiChoiceParams {
  question: string;
  answers: { text: string; correct: boolean; tipsAndFeedback?: { chosenFeedback?: string } }[];
  behaviour: { randomAnswers?: boolean };
}

/** H5P.Blanks parameters: each `*answer*` in a question is one blank. */
export interface BlanksParams {
  text: string;
  questions: string[];
}

/** H5P.DragText parameters: each `*word*` in the text is a drop zone; distractors are extra words. */
export interface DragTextParams {
  textField: string;
  distractors: string;
}

/** H5P.Column parameters (also each chapter of H5P.InteractiveBook). */
export interface ColumnParams {
  content: { content: SubContent; useSeparator: string }[];
}

/** H5P.QuestionSet parameters. */
export interface QuestionSetParams {
  questions: SubContent[];
  randomQuestions?: boolean;
  poolSize?: number;
}

/** H5P.CoursePresentation parameters. */
export interface CoursePresentationParams {
  presentation: { slides: { elements: { action?: SubContent }[]; keywords?: unknown[] }[] };
}

/** H5P.InteractiveBook parameters. */
export interface InteractiveBookParams {
  chapters: SubContent<ColumnParams>[];
}

/** H5P.BranchingScenario parameters: a node's ID is its index in `content`. */
export interface BranchingScenarioParams {
  branchingScenario: { content: { type: SubContent; nextContentId?: number }[] };
}

/** H5P.InteractiveVideo parameters. */
export interface InteractiveVideoParams {
  interactiveVideo: {
    assets: { interactions: { action: SubContent; duration: { from: number; to: number } }[] };
  };
}

/**
 * Applies an edit to a deep copy of the parameters.
 * @param params - The parameters as stored.
 * @param edit - Changes the copy in place.
 * @returns The edited copy.
 */
export function edited<P>(params: unknown, edit: (copy: P) => void): P {
  const copy = structuredClone(params) as P;
  edit(copy);
  return copy;
}

/**
 * A copy of a sub-content node and everything under it, with fresh `subContentId`s, as the editor's copy and paste
 * gives one.
 * @param node - The node.
 * @param change - Optional change to the copy's parameters.
 * @returns The copy.
 */
export function copyOfNode<P>(node: SubContent<P>, change?: (params: P) => void): SubContent<P> {
  const fresh = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(fresh);
    if (!value || typeof value !== 'object') return value;
    const entries = Object.entries(value).map(([key, inner]) => [key, fresh(inner)] as const);
    const out = Object.fromEntries(entries) as Record<string, unknown>;
    if (typeof out.library === 'string' && typeof out.subContentId === 'string')
      out.subContentId = randomUUID();
    return out;
  };
  const copy = fresh(node) as SubContent<P>;
  change?.(copy.params);
  return copy;
}

/**
 * Swaps two list items in place.
 * @param list - The list.
 * @param a - First index.
 * @param b - Second index.
 */
export function swap<T>(list: T[], a: number, b: number): void {
  const first = list[a] as T;
  list[a] = list[b] as T;
  list[b] = first;
}

/**
 * Replaces the first occurrence of a text in an HTML string, failing loudly when the probe's anchor text is gone.
 * @param html - The text to change.
 * @param from - Text that must be present.
 * @param to - Its replacement.
 * @returns The changed text.
 * @throws Error when `from` is not in `html`, so a changed example cannot make an edit silently do nothing.
 */
export function replaceText(html: string, from: string, to: string): string {
  if (!html.includes(from)) throw new Error(`edit anchor not found: ${from}`);
  return html.replace(from, to);
}

/**
 * The text a learner reads in an HTML string (tags removed, spaces collapsed).
 * @param html - Text from the parameters.
 * @returns The plain text.
 */
export const plainText = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Renumbers BranchingScenario node references after nodes were inserted or removed, as the editor does: every
 * `nextContentId` of a node and of a branching question's alternatives goes through `map`.
 * @param params - BranchingScenario parameters, changed in place.
 * @param map - Old node ID → new node ID (-1 is the end screen).
 */
export function renumberNodes(params: BranchingScenarioParams, map: (id: number) => number): void {
  for (const node of params.branchingScenario.content) {
    if (typeof node.nextContentId === 'number' && node.nextContentId >= 0)
      node.nextContentId = map(node.nextContentId);
    const question = node.type.params.branchingQuestion as
      { alternatives?: { nextContentId?: number }[] } | undefined;
    for (const alternative of question?.alternatives ?? []) {
      const next = alternative.nextContentId;
      if (typeof next === 'number' && next >= 0) alternative.nextContentId = map(next);
    }
  }
}

/**
 * Changes the lines of a DragText text, each of which holds one drop zone in the example.
 * @param params - DragText parameters, changed in place.
 * @param change - Changes the list of lines in place.
 */
export function editLines(params: DragTextParams, change: (lines: string[]) => void): void {
  const lines = params.textField.split('\n');
  change(lines);
  params.textField = lines.join('\n');
}
