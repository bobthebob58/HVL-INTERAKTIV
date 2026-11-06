/**
 * noScoreActivities — which activities can never send Canvas a score, and why, so the Deep Linking picker can tell
 * the teacher before a graded placement makes a gradebook column that stays empty.
 *
 * Why: probe P1 (D-115) found three cases with no gradable root result: ImageHotspots sends no xAPI statement at all,
 *      InteractiveVideo sends a root score only from a submit screen its author added (the `fa-video` pattern has
 *      none), and BranchingScenario with the scoring option `no-score` has a maximum of 0. For these no
 *      `GradeSyncJob` is ever written (LTI-012, D-104), so an `assignment_selection` placement gives Canvas an
 *      assignment whose column never gets points. D-115 has the picker say so, in nn, nb and en.
 * Spec: LTI-012, LTI-013, LTI-005
 * Invariants:
 *   - Exactly D-115's three cases: `H5P.ImageHotspots`; `H5P.InteractiveVideo` whose
 *     `interactiveVideo.assets.endscreens` is not a non-empty list; `H5P.BranchingScenario` whose
 *     `branchingScenario.scoringOptionGroup.scoringOption` is neither `static-end-score` nor `dynamic-score` (H5P's
 *     own default is `no-score`). Every other activity counts as one that can send a score.
 *   - Params are read only for InteractiveVideo and BranchingScenario rows, and only these two paths in them.
 *   - Not covered (a residual, D-115): content whose maximum is 0 for another reason, such as a Column of texts.
 * Collaborators: ./deepLinkActivities.ts (adds the reason to the picker's list), ../pages/deepLinkPickerPage.ts
 *   (shows it), ../../i18n/locales/*.json (`deepLinkGrading.noScore`).
 * Tests: apps/server/test/lti/deepLinking/noScoreActivities.test.ts,
 *   apps/server/test/lti/deepLinking/noScoreNotice.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';

/** Why an activity sends Canvas no score (D-115); also the last part of its locale key. */
export type NoScoreReason = 'noStatements' | 'noSubmitScreen' | 'noScoring';

const IMAGE_HOTSPOTS = 'H5P.ImageHotspots';
const INTERACTIVE_VIDEO = 'H5P.InteractiveVideo';
const BRANCHING_SCENARIO = 'H5P.BranchingScenario';
/** The scoring options with which a BranchingScenario sends a score (its semantics' `scoringOption`). */
const SCORED_OPTIONS: readonly unknown[] = ['static-end-score', 'dynamic-score'];

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Follows a path of object keys; undefined where a step is missing or not an object. */
const at = (value: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>((node, key) => (isObject(node) ? node[key] : undefined), value);

/**
 * Tells whether, and why, an activity can never send Canvas a score (D-115).
 * @param mainLibrary - `H5PContent.mainLibrary`, a machine name such as `H5P.InteractiveVideo`.
 * @param params - The activity's content parameters (`H5PContent.params`); only read for the two types above.
 * @returns The reason, or undefined for an activity that can send a score.
 * @example
 * noScoreReasonOf('H5P.ImageHotspots', {}); // 'noStatements'
 * @spec LTI-012
 */
export function noScoreReasonOf(mainLibrary: string, params: unknown): NoScoreReason | undefined {
  if (mainLibrary === IMAGE_HOTSPOTS) return 'noStatements';
  if (mainLibrary === INTERACTIVE_VIDEO) {
    const endscreens = at(params, ['interactiveVideo', 'assets', 'endscreens']);
    // WHY: only «Send inn svar» on a submit screen makes the video send its root score (D-115, Q18).
    return Array.isArray(endscreens) && endscreens.length > 0 ? undefined : 'noSubmitScreen';
  }
  if (mainLibrary === BRANCHING_SCENARIO) {
    const option = at(params, ['branchingScenario', 'scoringOptionGroup', 'scoringOption']);
    return SCORED_OPTIONS.includes(option) ? undefined : 'noScoring';
  }
  return undefined;
}

/**
 * Finds the listed activities that can never send Canvas a score.
 * @param db - The database.
 * @param activities - The picker's activities: ID and main library.
 * @returns The reason per activity ID, for those that send no score.
 * @spec LTI-012
 */
export async function noScoreReasons(
  db: Database,
  activities: readonly { readonly id: string; readonly mainLibrary: string }[],
): Promise<ReadonlyMap<string, NoScoreReason>> {
  const reasons = new Map<string, NoScoreReason>();
  const withParams: string[] = [];
  for (const { id, mainLibrary } of activities) {
    if (mainLibrary === IMAGE_HOTSPOTS) reasons.set(id, 'noStatements');
    if (mainLibrary === INTERACTIVE_VIDEO || mainLibrary === BRANCHING_SCENARIO) withParams.push(id);
  }
  if (withParams.length === 0) return reasons;
  // WHY: params can be large, so only the two types whose settings decide are read, in one query.
  const rows = await db.h5PContent.findMany({
    where: { id: { in: withParams } },
    select: { id: true, mainLibrary: true, params: true },
  });
  for (const row of rows) {
    const reason = noScoreReasonOf(row.mainLibrary, row.params);
    if (reason) reasons.set(row.id, reason);
  }
  return reasons;
}
