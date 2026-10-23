/**
 * videoSummaryHint (PED-H03) — an InteractiveVideo ends with a summary or a reflection task.
 *
 * Why: closing a video with a task that asks learners to sum up or reflect consolidates what they watched
 *      (Brame 2016, "Effective educational videos").
 * Spec: PED-020
 * Invariants:
 *   - Satisfied by the video's own summary task (`interactiveVideo.summary.task`, H5P.Summary) with at least one
 *     statement, or by a summary or reflection task (../contentKinds.ts REFLECTION_LIBRARIES) as the last
 *     interaction on the timeline.
 *   - H5P's default summary task has a statement list with no text; that counts as no summary.
 * Collaborators: ../videoTimeline.ts, ../contentKinds.ts.
 * Tests: apps/server/test/validation/rules/videoSummaryHint.test.ts
 */
import { REFLECTION_LIBRARIES } from '../contentKinds.js';
import { pathOf } from '../contentPath.js';
import { asArray, asString, fieldAt } from '../paramReaders.js';
import { plainTextOf } from '../richText.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';
import { timelineOf } from '../videoTimeline.js';

const hasSummaryStatements = (params: unknown): boolean =>
  asArray(fieldAt(params, 'interactiveVideo', 'summary', 'task', 'params', 'summaries')).some((group) =>
    asArray(fieldAt(group, 'summary')).some((statement) => plainTextOf(asString(statement) ?? '') !== ''),
  );

const endsWithReflection = (params: unknown): boolean => {
  const last = timelineOf(params).interactions.at(-1);
  return last?.machineName !== undefined && REFLECTION_LIBRARIES.has(last.machineName);
};

/** PED-H03: end a video with a summary. */
export const videoSummaryHint: ValidationRule = {
  id: 'PED-H03',
  requirement: 'PED-020',
  severity: 'hint',
  messages: ['PED-H03.noSummary'],
  check(scope) {
    return nodesOf(scope, 'H5P.InteractiveVideo')
      .filter((node) => !hasSummaryStatements(node.params) && !endsWithReflection(node.params))
      .map((node): RuleHit => ({
        path: pathOf(node.path, 'interactiveVideo', 'summary', 'task'),
        message: 'PED-H03.noSummary',
      }));
  },
};
