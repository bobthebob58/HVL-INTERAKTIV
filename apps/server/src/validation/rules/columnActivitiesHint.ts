/**
 * columnActivitiesHint (PED-H08) — a Column holds more than `maxColumnActivities` (3) learner tasks.
 *
 * Why: many tasks on one long page raise the cognitive load; splitting them across pages follows the segmenting
 *      principle (Mayer 2009). Spec 04 §3 recommends one or two interactive items per Canvas page.
 * Spec: PED-020
 * Invariants:
 *   - Counts the Column's direct items that are learner tasks (../contentKinds.ts); text, images, links and
 *     videos without questions do not count.
 *   - Applies to every `H5P.Column`, including the chapters of an InteractiveBook.
 * Collaborators: ../contentKinds.ts, ../hintThresholds.ts.
 * Tests: apps/server/test/validation/rules/columnActivitiesHint.test.ts
 */
import { isLearnerTask, machineNameOf } from '../contentKinds.js';
import { pathOf } from '../contentPath.js';
import { thresholdOf } from '../hintThresholds.js';
import { asArray, asString, fieldAt } from '../paramReaders.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';

/** PED-H08: split long columns. */
export const columnActivitiesHint: ValidationRule = {
  id: 'PED-H08',
  requirement: 'PED-020',
  severity: 'warning',
  messages: ['PED-H08.tooMany'],
  check(scope) {
    // PEDAGOGY: 3 by default; spread tasks over pages (Mayer 2009, segmenting principle).
    const max = thresholdOf(scope.context, 'maxColumnActivities');
    const hits: RuleHit[] = [];
    for (const node of nodesOf(scope, 'H5P.Column')) {
      const count = asArray(fieldAt(node.params, 'content')).filter((item) =>
        isLearnerTask(machineNameOf(asString(fieldAt(item, 'content', 'library')) ?? '')),
      ).length;
      if (count > max) {
        hits.push({ path: pathOf(node.path, 'content'), message: 'PED-H08.tooMany', values: { count, max } });
      }
    }
    return hits;
  },
};
