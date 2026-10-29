/**
 * realPatternSwitches — the formative settings of PROD-009, per content type, as they are read from a stored
 * activity's parameters: which switches must be on, which gates must be off, and where a pass mark is allowed.
 *
 * Why: PROD-009 asks that every pattern keeps retry and «Vis svar» on, sets no time limit, and makes pass marks
 *      informative rather than gatekeeping. The creation tests check this on what H5P stores after the skeleton,
 *      the library defaults and the save path have all had their say, not on the skeleton files.
 * Spec: PROD-009, PED-010
 * Invariants:
 *   - One rule per content type, applied to every node of that type (the activity itself and every sub-content),
 *     read through the validator's walker (../../../src/validation/contentWalker.ts).
 *   - A switch must be stored as on (`true` or `"on"`); a container override that is left empty is allowed, since
 *     the tasks' own switches then apply, and those are checked on the tasks.
 *   - A pass mark is informative when the attempt that misses it can be retried: wherever `passPercentage` is
 *     stored (QuestionSet's own, MultiChoice's `behaviour.passPercentage`), the node's own retry switch is on.
 *   - No key anywhere looks like a timer or a time limit.
 *   - Blanks matches case-insensitively and accepts small typos (spec 04 §4, `ea-terms`); every pattern's Blanks
 *     does, as forgiving matching is part of the formative defaults.
 *   - Messages name the node's path and the setting, never a content text.
 * Collaborators: ./realPatternDefaults.int.test.ts and ./realPatternSkeletons.test.ts (apply it),
 *   ../../../src/validation/contentWalker.ts.
 * Tests: apps/server/test/learningDesign/patterns/realPatternSwitches.test.ts (the rules themselves),
 *   apps/server/test/learningDesign/patterns/realPatternDefaults.int.test.ts,
 *   apps/server/test/learningDesign/patterns/realPatternSkeletons.test.ts
 */
import type { ContentNode } from '../../../src/validation/contentWalker.js';
import { asArray, fieldAt } from '../../../src/validation/paramReaders.js';

type Rule = (params: unknown) => string[];

const ON = new Set<unknown>([true, 'on']);

const mustBeOn =
  (...keys: readonly (readonly string[])[]): Rule =>
  (params) =>
    keys.filter((path) => !ON.has(fieldAt(params, ...path))).map((path) => `${path.join('.')} is not on`);

const mustNotBe =
  (path: readonly string[], ...forbidden: readonly unknown[]): Rule =>
  (params) =>
    forbidden.includes(fieldAt(params, ...path))
      ? [`${path.join('.')} is ${String(fieldAt(params, ...path))}`]
      : [];

const overridesNotOff: Rule = (params) =>
  ['retryButton', 'showSolutionButton']
    .filter((key) => fieldAt(params, 'override', key) === 'off')
    .map((key) => `override.${key} is off`);

const all =
  (...rules: readonly Rule[]): Rule =>
  (params) =>
    rules.flatMap((rule) => rule(params));

const TASK_SWITCHES = mustBeOn(['behaviour', 'enableRetry'], ['behaviour', 'enableSolutionsButton']);

/** The rule of each content type a pattern may hold; a type without a rule has no formative switch. */
const RULES: Readonly<Record<string, Rule>> = {
  'H5P.MultiChoice': TASK_SWITCHES,
  'H5P.TrueFalse': TASK_SWITCHES,
  'H5P.DragText': TASK_SWITCHES,
  'H5P.Blanks': all(
    TASK_SWITCHES,
    mustNotBe(['behaviour', 'caseSensitive'], true),
    mustBeOn(['behaviour', 'acceptSpellingErrors']),
  ),
  'H5P.QuestionSet': all(
    mustBeOn(
      ['endGame', 'showResultPage'],
      ['endGame', 'showRetryButton'],
      ['endGame', 'showSolutionButton'],
    ),
    mustNotBe(['disableBackwardsNavigation'], true),
    overridesNotOff,
  ),
  'H5P.CoursePresentation': all(
    overridesNotOff,
    mustNotBe(['override', 'summarySlideRetryButton'], false),
    mustNotBe(['override', 'summarySlideSolutionButton'], false),
    // A11Y: Active Surface Mode turns the slides' keyboard navigation off (spec 04 §4: keyboard navigation on).
    mustNotBe(['override', 'activeSurface'], true),
  ),
  'H5P.InteractiveVideo': all(
    overridesNotOff,
    mustNotBe(['override', 'preventSkippingMode'], 'forward', 'both'),
    (params) =>
      asArray(fieldAt(params, 'interactiveVideo', 'assets', 'interactions'))
        .map(
          (interaction, index) => [fieldAt(interaction, 'adaptivity', 'requireCompletion'), index] as const,
        )
        .filter(([required]) => required === true)
        .map(([, index]) => `interaction ${index} must be completed before the video goes on`),
  ),
  'H5P.InteractiveBook': mustBeOn(['behaviour', 'enableRetry']),
  'H5P.BranchingScenario': all(
    mustNotBe(['branchingScenario', 'behaviour', 'forceContentFinished'], true),
    (params) =>
      asArray(fieldAt(params, 'branchingScenario', 'content'))
        .map((item, index) => [fieldAt(item, 'forceContentFinished'), index] as const)
        .filter(([forced]) => forced === 'enabled')
        .map(([, index]) => `content ${index} must be finished before the learner may go on`),
  ),
};

const RETRY_OF: readonly (readonly string[])[] = [
  ['behaviour', 'enableRetry'],
  ['endGame', 'showRetryButton'],
];

const PASS_MARKS: readonly (readonly string[])[] = [['passPercentage'], ['behaviour', 'passPercentage']];

const passMarkGates: Rule = (params) =>
  PASS_MARKS.filter((path) => fieldAt(params, ...path) !== undefined)
    .filter(() => !RETRY_OF.some((path) => ON.has(fieldAt(params, ...path))))
    .map((path) => `${path.join('.')} is set, but a missed pass mark cannot be retried`);

const TIMER_KEY = /time.?limit|timer|countdown/i;

function timerKeys(value: unknown, path: string): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => timerKeys(item, `${path}[${index}]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(TIMER_KEY.test(key) ? [`${path}.${key} looks like a time limit`] : []),
    ...timerKeys(child, `${path}.${key}`),
  ]);
}

/**
 * Every place where a created activity is not formative as PROD-009 sets out.
 * @param nodes - The activity and its sub-content, from `walkContent`.
 * @returns One line per problem, naming the node's type and path and the setting; empty when all is formative.
 */
export function formativeViolations(nodes: readonly ContentNode[]): string[] {
  const [activity] = nodes;
  return [
    ...nodes.flatMap((node) => {
      const rule = node.machineName === undefined ? undefined : RULES[node.machineName];
      const problems = [...(rule ? rule(node.params) : []), ...passMarkGates(node.params)];
      return problems.map((problem) => `${node.library} at "${node.path}": ${problem}`);
    }),
    ...timerKeys(activity?.params, 'params'),
  ];
}
