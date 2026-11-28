/**
 * insightBranchingAnswers — the insight view of a Branching Scenario the Innsikt tab's tests fake (INS-004): two
 * decisions with shown and hidden first choices, a decision and an option without text, and the count of learners
 * who chose again.
 *
 * Why: the numbers are the server fixture's (apps/server/test/insight/fixtures/README.md, twenty learners), so what
 *      the tab shows here is what a real view holds; the third decision has no text, which the tab must still name.
 * Spec: INS-004, INS-006
 * Collaborators: ./insightAnswers.ts.
 * Tests: apps/web/test/features/insight/InsightBranching.test.tsx
 */
import type { InsightReport } from '../../../src/features/insight/insightReportShape';
import { HIDDEN, REPORT, shown } from './insightAnswers';

/** A scenario with three decisions; the last has neither a question text nor a text for its second option. */
export const BRANCHING_REPORT: InsightReport = {
  ...REPORT,
  activity: { mainLibrary: 'H5P.BranchingScenario', sendsLearningData: true, sendsRootResult: true },
  items: [],
  misconceptions: [],
  branching: [
    {
      item: 'd-1',
      questionText: 'Korleis vil du bruke tida før samlinga?',
      learners: shown(19),
      options: [
        { index: 0, text: 'Ein kort video og ein quiz', learners: shown(10) },
        { index: 1, text: 'Ei lang pensumliste', learners: shown(9) },
      ],
      choseAgain: shown(8),
    },
    {
      item: 'd-2',
      questionText: 'Korleis gjer du materiellet tilgjengeleg?',
      learners: shown(16),
      options: [
        { index: 0, text: 'Tekstar videoen', learners: shown(11) },
        { index: 1, text: 'Eigne versjonar på førespurnad', learners: HIDDEN },
        { index: 2, text: 'Papir på samlinga', learners: HIDDEN },
      ],
      choseAgain: shown(0),
    },
    {
      item: 'd-3',
      questionText: '',
      learners: HIDDEN,
      options: [
        { index: 0, text: 'Ja', learners: HIDDEN },
        { index: 1, text: '', learners: HIDDEN },
      ],
      choseAgain: HIDDEN,
    },
  ],
};
