/**
 * insightBranchingFixture — the fixed, already suppressed insight view of a Branching Scenario that the accessibility
 * suite's routed API answers: three decisions, with shown counts, «< k» cells and one decision hidden altogether.
 *
 * Why: UD-030 scans the decisions' part of the Innsikt tab (INS-004) in one fixed state, whatever the stored
 *      learners: every kind of cell a teacher can meet there, and a decision and an option without text.
 * Spec: UD-030, INS-004, INS-006
 * Invariants: built on ./insightFixture.ts's view (scope, participation); it has no questions, only decisions.
 * Collaborators: ./insightFixture.ts, ./insightViews.ts.
 * Tests: apps/server/a11y/axeInsightBranching.a11y.test.ts
 */
import { insightView, LAST_SEVEN_DAYS, type InsightViewPeriod } from './insightFixture.js';

/** A value shown, and one hidden below k (INS-006). */
const shown = (value: number) => ({ suppressed: false, value });
const HIDDEN = { suppressed: true };

/** The first decision of the Branching Scenario's view. */
export const FIRST_DECISION = 'Korleis vil du bruke tida før samlinga?';

/**
 * The view of a Branching Scenario the routed API answers (INS-004): three decisions, with shown counts, «< k»
 * cells and one decision hidden altogether; no questions.
 * @param contentId - The activity.
 * @param context - The context the view covers.
 * @param period - The view's period, start and end: by default the last 7 days to 4 November 2026.
 * @returns The insight answer.
 */
export function branchingView(
  contentId: string,
  context: { key: string; label: string | null },
  period: InsightViewPeriod = LAST_SEVEN_DAYS,
) {
  const option = (index: number, text: string, learners: object) => ({ index, text, learners });
  const decision = (
    item: string,
    questionText: string,
    learners: object,
    options: object[],
    again: object,
  ) => ({
    item,
    questionText,
    learners,
    options,
    choseAgain: again,
  });
  return {
    ...insightView(contentId, context, period),
    activity: { mainLibrary: 'H5P.BranchingScenario', sendsLearningData: true, sendsRootResult: true },
    items: [],
    misconceptions: [],
    branching: [
      decision(
        'd1',
        FIRST_DECISION,
        shown(22),
        [option(0, 'Ein kort video og ein quiz', shown(13)), option(1, 'Ei lang pensumliste', shown(9))],
        shown(8),
      ),
      decision(
        'd2',
        'Korleis gjer du materiellet tilgjengeleg for alle?',
        shown(18),
        [
          option(0, 'Tekstar videoen og legg ut alt på førehand', shown(12)),
          option(1, 'Lagar eigne versjonar på førespurnad', HIDDEN),
          option(2, 'Deler ut papir på samlinga', HIDDEN),
        ],
        shown(0),
      ),
      decision('d3', '', HIDDEN, [option(0, 'Ja', HIDDEN), option(1, '', HIDDEN)], HIDDEN),
    ],
  };
}
