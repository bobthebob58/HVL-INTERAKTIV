/**
 * branchingDecisions — the decisions of an H5P.BranchingScenario: each branching question with the options a
 * learner chooses between, read from the activity's parameters.
 *
 * Why: INS-004 shows how the learners' choices are spread over the options of each decision. A stored choice is the
 *      option's index under the decision's `subContentId` (D-154), so the view needs the decisions and their
 *      options, with their texts, from the same parameters the learners played.
 * Spec: INS-004
 * Invariants:
 *   - Only for the main library H5P.BranchingScenario. A decision is a node of `branchingScenario.content` whose
 *     `type` is an H5P.BranchingQuestion with a `subContentId`. A node without one is left out: the server stores
 *     no answer without an ID (D-121). A repeated ID counts once, the first.
 *   - The options are in stored order, since a choice is stored as the option's index.
 *   - Texts are plain text, cut to insight's length (./questionShapes.ts). Never throws on author data.
 *   - A decision is not a question: it is in no question catalogue (./questionCatalogue.ts) and has no right answer.
 * Collaborators: ../aggregate/branchingChoices.ts, ../buildInsightReport.ts, ./answerKeys.ts,
 *   ../../learningDesign/safeEditing/subContentNodes.ts.
 * Tests: apps/server/test/insight/branchingDecisions.test.ts
 */
import {
  libraryKey,
  listOf,
  machineNameOf,
  objectOf,
} from '../../learningDesign/safeEditing/subContentNodes.js';
import { insightText } from './questionShapes.js';

/** The main library whose activities have decisions. */
export const BRANCHING_SCENARIO = 'H5P.BranchingScenario';

/** One decision of a scenario. */
export interface BranchingDecision {
  /** The `subContentId` the decision's stored choices carry. */
  readonly item: string;
  /** The question as plain text, or '' when the parameters hold none. */
  readonly text: string;
  /** The options' texts in stored order; a stored choice is an index into this list. */
  readonly options: readonly string[];
}

/**
 * Lists a scenario's decisions.
 * @param mainLibrary - The main library's machine name, e.g. `H5P.BranchingScenario`.
 * @param params - The activity's parameters (content.json).
 * @returns The decisions in the content's order; none for any other main library.
 * @example
 * branchingDecisions('H5P.BranchingScenario', params);
 * // → [{ item: 'b3a7…3c02', text: 'Korleis vil du bruke tida før samlinga?', options: ['Eg lagar …', 'Eg sender …'] }]
 * @spec INS-004
 */
export function branchingDecisions(mainLibrary: string, params: unknown): BranchingDecision[] {
  if (mainLibrary !== BRANCHING_SCENARIO) return [];
  const found = new Map<string, BranchingDecision>();
  for (const node of listOf(objectOf(objectOf(params).branchingScenario).content)) {
    const type = objectOf(objectOf(node).type);
    const { library, subContentId: item } = type;
    if (typeof library !== 'string' || machineNameOf(libraryKey(library)) !== 'H5P.BranchingQuestion')
      continue;
    if (typeof item !== 'string' || item === '' || found.has(item)) continue;
    const question = objectOf(objectOf(type.params).branchingQuestion);
    found.set(item, {
      item,
      text: insightText(question.question),
      options: listOf(question.alternatives).map((alternative) => insightText(objectOf(alternative).text)),
    });
  }
  return [...found.values()];
}
