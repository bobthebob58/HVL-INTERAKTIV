/**
 * videoLengthHint (PED-H01) — an InteractiveVideo longer than `maxVideoMinutes` (15) should be split into
 * segments of 6–9 minutes.
 *
 * Why: engagement with lecture videos drops sharply after about six minutes (Guo, Kim & Rubin 2014); shorter
 *      segments also follow the segmenting principle (Mayer 2009).
 * Spec: PED-020
 * Invariants:
 *   - Limitation: H5P does not store the video's duration in content.json and the validator cannot open the
 *     file (it is pure, D-073). The length is known only as a lower bound: the latest interaction, bookmark or
 *     submit screen. A long video with nothing placed late in it is not detected.
 *   - Severity warning; the threshold comes from content/laeringsdesign/hint-thresholds.yaml.
 *   - The message shows the length rounded up to a tenth of a minute (`minutesShown`), so it is always above the
 *     threshold that triggered it ("at least 15.1", never "at least 15 (at most 15)").
 * Collaborators: ../videoTimeline.ts, ../hintThresholds.ts.
 * Tests: apps/server/test/validation/rules/videoLengthHint.test.ts
 */
import { pathOf } from '../contentPath.js';
import { thresholdOf } from '../hintThresholds.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';
import { minutesShown, timelineOf } from '../videoTimeline.js';

/** PED-H01: long videos should be split. */
export const videoLengthHint: ValidationRule = {
  id: 'PED-H01',
  requirement: 'PED-020',
  severity: 'warning',
  messages: ['PED-H01.tooLong'],
  check(scope) {
    // PEDAGOGY: 15 minutes by default, from Guo, Kim & Rubin (2014); segments of 6–9 minutes are recommended.
    const max = thresholdOf(scope.context, 'maxVideoMinutes');
    const hits: RuleHit[] = [];
    for (const node of nodesOf(scope, 'H5P.InteractiveVideo')) {
      const seconds = timelineOf(node.params).knownEnd;
      if (seconds / 60 <= max) continue;
      hits.push({
        path: pathOf(node.path, 'interactiveVideo', 'video', 'files'),
        message: 'PED-H01.tooLong',
        values: { minutes: minutesShown(seconds), max },
      });
    }
    return hits;
  },
};
