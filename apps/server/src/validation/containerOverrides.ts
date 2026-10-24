/**
 * containerOverrides — the behaviour settings that QuestionSet, CoursePresentation and InteractiveVideo force on
 * their direct tasks, so a rule can tell what the learner really gets.
 *
 * Why: these containers have an "override" for "Show solution" and "Retry". When it is "on" or "off", the player
 *      overwrites `behaviour.enableSolutionsButton` / `behaviour.enableRetry` of every direct task, whatever the
 *      task itself says, so PED-H07 must not report a task's own switch that the container turns back on.
 * Spec: PED-020
 * Invariants:
 *   - UPSTREAM: modelled on QuestionSet 1.21 `questionset.js` (https://github.com/h5p/h5p-question-set),
 *     CoursePresentation 1.28 `setElementsOverride` (https://github.com/h5p/h5p-course-presentation) and
 *     InteractiveVideo 1.28 `initInteraction` (https://github.com/h5p/h5p-interactive-video): a set override
 *     forces `value === "on"`; an empty override changes nothing. InteractiveVideo also forces retry on for an
 *     interaction that requires completion (`adaptivity.requireCompletion`) whenever it has an override.
 *   - Direct tasks only: `questions[n]`, `presentation.slides[n].elements[m].action`,
 *     `interactiveVideo.assets.interactions[n].action`; deeper sub-content keeps its own settings.
 *   - Keys are the `path` of the task's node (its params), as contentWalker gives it.
 * Collaborators: ./rules/retryAndSolutionsHint.ts, ./contentWalker.ts.
 * Tests: apps/server/test/validation/rules/retryAndSolutionsHint.test.ts
 */
import type { ContentNode } from './contentWalker.js';
import { pathOf, type PathSegment } from './contentPath.js';
import { asArray, fieldAt } from './paramReaders.js';

/** The behaviour settings a container forces on one task (only those it sets). */
export type ForcedBehaviour = Readonly<Partial<Record<'enableRetry' | 'enableSolutionsButton', boolean>>>;

/** Where a container keeps its direct tasks: the list, and the key of each task's sub-content in an item. */
const TASK_LISTS: Readonly<Record<string, (params: unknown) => readonly (readonly PathSegment[])[]>> = {
  'H5P.QuestionSet': (params) => asArray(fieldAt(params, 'questions')).map((_, n) => ['questions', n]),
  'H5P.CoursePresentation': (params) =>
    asArray(fieldAt(params, 'presentation', 'slides')).flatMap((slide, n) =>
      asArray(fieldAt(slide, 'elements')).map((_, m) => [
        'presentation',
        'slides',
        n,
        'elements',
        m,
        'action',
      ]),
    ),
  'H5P.InteractiveVideo': (params) =>
    asArray(fieldAt(params, 'interactiveVideo', 'assets', 'interactions')).map((_, n) => [
      'interactiveVideo',
      'assets',
      'interactions',
      n,
      'action',
    ]),
};

const overrideOf = (params: unknown): ForcedBehaviour => {
  const [solutions, retry] = [
    fieldAt(params, 'override', 'showSolutionButton'),
    fieldAt(params, 'override', 'retryButton'),
  ];
  return {
    ...(solutions ? { enableSolutionsButton: solutions === 'on' } : {}),
    ...(retry ? { enableRetry: retry === 'on' } : {}),
  };
};

/**
 * The behaviour each direct task of a container is forced to.
 * @param nodes - All nodes from `walkContent`.
 * @returns For each forced task's params path, the settings its container forces; tasks without a forcing
 *   container are not in the map.
 */
export function forcedBehaviours(nodes: readonly ContentNode[]): ReadonlyMap<string, ForcedBehaviour> {
  const forced = new Map<string, ForcedBehaviour>();
  for (const node of nodes) {
    const tasks = node.machineName === undefined ? undefined : TASK_LISTS[node.machineName];
    const override = overrideOf(node.params);
    if (!tasks || Object.keys(override).length === 0) continue;
    for (const at of tasks(node.params)) {
      // WHY: InteractiveVideo keeps retry on for an interaction the learner must complete (see UPSTREAM above).
      const mustComplete =
        node.machineName === 'H5P.InteractiveVideo' &&
        fieldAt(node.params, ...at.slice(0, -1), 'adaptivity', 'requireCompletion') === true;
      forced.set(
        pathOf(node.path, ...at, 'params'),
        mustComplete ? { ...override, enableRetry: true } : override,
      );
    }
  }
  return forced;
}
