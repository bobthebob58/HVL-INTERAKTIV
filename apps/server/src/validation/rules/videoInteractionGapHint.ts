/**
 * videoInteractionGapHint (PED-H02) — an InteractiveVideo runs for more than `maxMinutesWithoutInteraction` (4)
 * minutes without a check of understanding.
 *
 * Why: short questions interspersed in a video reduce mind wandering and improve learning (Szpunar, Khan &
 *      Schacter 2013); a check every 2–3 minutes is the recommendation in spec 04 §5.
 * Spec: PED-020
 * Invariants:
 *   - Only learner tasks count as checks (../contentKinds.ts); a text, image, link or label does not.
 *   - Gaps are measured from 0 to the first task, between tasks, and from the last task to the latest known time
 *     (bookmark, submit screen or interaction end). Limitation: the video's real duration is not in content.json,
 *     so the stretch after the latest known time is not measured.
 *   - One hint per video, naming its longest gap rounded up to a tenth of a minute (`minutesShown`), so the
 *     message never shows a gap at or below the threshold that triggered it.
 * Collaborators: ../videoTimeline.ts, ../contentKinds.ts, ../hintThresholds.ts.
 * Tests: apps/server/test/validation/rules/videoInteractionGapHint.test.ts
 */
import { isLearnerTask } from '../contentKinds.js';
import { pathOf } from '../contentPath.js';
import { thresholdOf } from '../hintThresholds.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';
import { minutesShown, timelineOf } from '../videoTimeline.js';

/**
 * The longest stretch without a task.
 * @param taskTimes - Start times of the tasks, sorted, in seconds.
 * @param knownEnd - The latest known time, in seconds.
 * @returns The longest gap, in seconds.
 */
export function longestGap(taskTimes: readonly number[], knownEnd: number): number {
  const points = [0, ...taskTimes, Math.max(knownEnd, taskTimes.at(-1) ?? 0)];
  return points.slice(1).reduce((longest, time, i) => Math.max(longest, time - (points[i] ?? 0)), 0);
}

/** PED-H02: add a check every few minutes. */
export const videoInteractionGapHint: ValidationRule = {
  id: 'PED-H02',
  requirement: 'PED-020',
  severity: 'hint',
  messages: ['PED-H02.gap'],
  check(scope) {
    // PEDAGOGY: 4 minutes by default, after Szpunar, Khan & Schacter (2013) (a check every 2–3 minutes).
    const max = thresholdOf(scope.context, 'maxMinutesWithoutInteraction');
    const hits: RuleHit[] = [];
    for (const node of nodesOf(scope, 'H5P.InteractiveVideo')) {
      const timeline = timelineOf(node.params);
      const tasks = timeline.interactions.filter((i) => isLearnerTask(i.machineName)).map((i) => i.from);
      const seconds = longestGap(tasks, timeline.knownEnd);
      if (seconds / 60 <= max) continue;
      hits.push({
        path: pathOf(node.path, 'interactiveVideo', 'assets', 'interactions'),
        message: 'PED-H02.gap',
        values: { minutes: minutesShown(seconds), max },
      });
    }
    return hits;
  },
};
