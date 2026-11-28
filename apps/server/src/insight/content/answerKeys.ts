/**
 * answerKeys — what insight judges each question's answers by: for a choice question which options are correct, for
 * a gap task the answers each gap accepts and whether upper and lower case differ, for a Branching Scenario's
 * decision its options; and whether two versions of an activity's parameters differ in it.
 *
 * Why: insight shows one content version at a time so that it compares like with like (DATA-012, PROD-013). INS-003
 *      marks options and gap answers right or wrong by the stored parameters, while INS-002's share comes from each
 *      answer's own stored verdict. If an author changes an answer key and the version stays, answers judged
 *      against the old key are shown against the new one, and the two lists no longer agree, which the
 *      suppression of small groups relies on (INS-006). A save that changes a key therefore starts a new version
 *      (D-137); this module says when.
 * Spec: INS-003, INS-004, INS-006, PROD-013
 * Invariants:
 *   - The keys are read with insight's own readers (./questionCatalogue.ts, ./questionShapes.ts), so what
 *     ../aggregate/choiceDistribution.ts and ../aggregate/gapMisconceptions.ts judge by is what is compared.
 *   - A choice question's key is its options' `correct` marks in stored order. A gap task's key is, per gap, the
 *     set of accepted answers as insight compares them (normalised; case kept only for a case-sensitive task),
 *     and whether the task is case-sensitive. Any other question has no key.
 *   - Question texts, option texts, tips and feedback are not part of a key, nor is the order of a gap's accepted
 *     alternatives.
 *   - A decision's key is its options' texts in stored order (./branchingDecisions.ts, D-154): a stored choice is
 *     an index, and the option is all a choice can be read by, so a reworded or moved option is a changed key.
 *   - Questions are matched by their item ID, never by order: PostgreSQL's jsonb orders object keys its own way,
 *     so the stored parameters and the editor's may list the same questions differently.
 *   - Pure; never throws on author data.
 * Collaborators: ./questionCatalogue.ts, ./questionShapes.ts, ./gapSolutions.ts, ./branchingDecisions.ts,
 *   ../../learningDesign/safeEditing/LearnerStateGate.ts (asks on every save of an existing activity).
 * Tests: apps/server/test/insight/answerKeys.test.ts
 */
import { libraryKey, machineNameOf } from '../../learningDesign/safeEditing/subContentNodes.js';
import { branchingDecisions } from './branchingDecisions.js';
import { normaliseGapAnswer } from './gapSolutions.js';
import { questionCatalogue } from './questionCatalogue.js';
import type { QuestionShape } from './questionShapes.js';

/** The answer key of each question that has one, by item ID (null: the activity itself). */
export type AnswerKeys = ReadonlyMap<string | null, string>;

/**
 * The answer key of one question.
 * @param shape - The question's shape, as insight reads it.
 * @returns The key as canonical JSON, or null for a question insight shows no answer distribution for.
 * @example
 * answerKeyOf({ kind: 'choice', options: [yes, no] }); // '["choice",[true,false]]'
 * @spec INS-003
 */
export function answerKeyOf(shape: QuestionShape): string | null {
  if (shape.kind === 'choice')
    return JSON.stringify(['choice', shape.options.map((option) => option.correct)]);
  if (shape.kind !== 'gaps') return null;
  const { caseSensitive } = shape;
  // WHY: a set in sorted order, as ../aggregate/gapMisconceptions.ts looks an answer up: `Oslo/Kristiania` and
  // `Kristiania/Oslo` accept the same answers.
  const gaps = shape.gaps.map((gap) =>
    [...new Set(gap.answers.map((answer) => normaliseGapAnswer(answer, caseSensitive)))].sort(),
  );
  return JSON.stringify(['gaps', caseSensitive, gaps]);
}

/**
 * The answer keys of an activity's questions.
 * @param mainLibrary - The main library, as a machine name or with its version (`H5P.QuestionSet 1.20`).
 * @param params - The activity's parameters (content.json), as stored or as the editor will store them.
 * @returns One entry per choice question and gap task, at any depth, and per decision of a Branching Scenario.
 * @spec INS-003
 */
export function answerKeys(mainLibrary: string, params: unknown): AnswerKeys {
  const keys = new Map<string | null, string>();
  const machineName = machineNameOf(libraryKey(mainLibrary));
  for (const question of questionCatalogue(machineName, params)) {
    const key = answerKeyOf(question.shape);
    if (key !== null) keys.set(question.item, key);
  }
  for (const { item, options } of branchingDecisions(machineName, params))
    keys.set(item, JSON.stringify(['decision', options]));
  return keys;
}

/**
 * Tells whether two versions of an activity judge any question's answers differently.
 * @param before - The keys of the stored parameters.
 * @param after - The keys of the parameters a save would store.
 * @returns True when a question's key differs, or a question with a key is in one version only.
 * @example
 * answerKeysDiffer(answerKeys(main, stored), answerKeys(main, edited)); // true: the save starts a new version
 * @spec PROD-013
 */
export function answerKeysDiffer(before: AnswerKeys, after: AnswerKeys): boolean {
  if (before.size !== after.size) return true;
  for (const [item, key] of before) {
    if (after.get(item) !== key) return true;
  }
  return false;
}
