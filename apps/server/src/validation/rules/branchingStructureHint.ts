/**
 * branchingStructureHint (PED-H06) — a BranchingScenario has 2–4 decision points on its main path, feedback on
 * every choice, and a way back.
 *
 * Why: a case trains professional judgement when learners decide, see the consequence explained, and may try
 *      another way (Schön 1983, reflection-in-action; spec 04 §3 "Practise judgement safely").
 * Spec: PED-020
 * Invariants:
 *   - Decision points are BranchingQuestion nodes; the main path is the path from the start that meets the most
 *     of them (../branchingGraph.ts). Too few or too many gives one finding on `branchingScenario.content`.
 *   - A choice without feedback (no title, text or image) gives one finding per choice.
 *   - A way back is backwards navigation (`behaviour.enableBackwardsNavigation`) or a loop to an earlier node.
 *   - Severity warning for all three, never error (spec 04 §5).
 * Collaborators: ../branchingGraph.ts, ../feedbackText.ts, ../hintThresholds.ts.
 * Tests: apps/server/test/validation/rules/branchingStructureHint.test.ts
 */
import { branchingGraphOf, decisionPointsOnMainPath, hasLoopFromStart } from '../branchingGraph.js';
import type { ContentNode } from '../contentWalker.js';
import { pathOf } from '../contentPath.js';
import { isBlankText } from '../feedbackText.js';
import { thresholdOf } from '../hintThresholds.js';
import { asArray, asString, fieldAt } from '../paramReaders.js';
import { nodesOf, type RuleHit, type RuleScope, type ValidationRule } from '../rule.js';

const hasFeedback = (feedback: unknown): boolean =>
  !isBlankText(asString(fieldAt(feedback, 'title'))) ||
  !isBlankText(asString(fieldAt(feedback, 'subtitle'))) ||
  (asString(fieldAt(feedback, 'image', 'path')) ?? '') !== '';

const QUESTION = ['type', 'params', 'branchingQuestion', 'alternatives'] as const;

const choicesWithoutFeedback = (node: ContentNode, content: readonly unknown[]): RuleHit[] =>
  content.flatMap((item, i) =>
    asArray(fieldAt(item, ...QUESTION)).flatMap((alternative, j): RuleHit[] =>
      hasFeedback(fieldAt(alternative, 'feedback'))
        ? []
        : [
            {
              path: pathOf(node.path, 'branchingScenario', 'content', i, ...QUESTION, j, 'feedback'),
              message: 'PED-H06.choiceFeedback',
            },
          ],
    ),
  );

function checkScenario(scope: RuleScope, node: ContentNode): RuleHit[] {
  const content = asArray(fieldAt(node.params, 'branchingScenario', 'content'));
  if (content.length === 0) return [];
  const graph = branchingGraphOf(content);
  const hits = choicesWithoutFeedback(node, content);
  // PEDAGOGY: 2–4 decision points by default; cases of 3–4 decisions (Schön 1983, spec 04 §5).
  const [min, max] = [
    thresholdOf(scope.context, 'minDecisionPoints'),
    thresholdOf(scope.context, 'maxDecisionPoints'),
  ];
  const count = decisionPointsOnMainPath(graph);
  if (count !== undefined && (count < min || count > max)) {
    const path = pathOf(node.path, 'branchingScenario', 'content');
    hits.push({ path, message: 'PED-H06.decisionPoints', values: { count, min, max } });
  }
  const backwards =
    fieldAt(node.params, 'branchingScenario', 'behaviour', 'enableBackwardsNavigation') === true;
  if (!backwards && !hasLoopFromStart(graph)) {
    const path = pathOf(node.path, 'branchingScenario', 'behaviour', 'enableBackwardsNavigation');
    hits.push({ path, message: 'PED-H06.noWayBack' });
  }
  return hits;
}

/** PED-H06: keep cases short, explained and open to a second try. */
export const branchingStructureHint: ValidationRule = {
  id: 'PED-H06',
  requirement: 'PED-020',
  severity: 'warning',
  messages: ['PED-H06.decisionPoints', 'PED-H06.choiceFeedback', 'PED-H06.noWayBack'],
  check: (scope) => nodesOf(scope, 'H5P.BranchingScenario').flatMap((node) => checkScenario(scope, node)),
};
