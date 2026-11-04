/**
 * buildInsightReport — assembles one insight view from the scope, the activity's parameters and the view's
 * statements: participation, item difficulty, misconceptions and, for an InteractiveVideo, video engagement, every
 * number already suppressed.
 *
 * Why: the aggregates are pure functions of what the view covers; keeping them apart from the database and the
 *      content store lets the hand-calculated 30-learner fixture (INS-001's acceptance) and the INS-006 property tests
 *      run on exactly what the service sends.
 * Spec: INS-001, INS-002, INS-003, INS-005, INS-006
 * Invariants:
 *   - PRIVACY: the statements carry learner numbers, not keys (./data/insightStatements.ts), and the report holds
 *     only cells from ./suppression/insightCells.ts and texts from the parameters or given by k learners (INS-006).
 *   - PRIVACY: when the learners who started number 1 to k − 1, every item and misconception cell is suppressed, a 0
 *     too, as participation and video engagement already do: "nobody answered Q2" would describe each of them.
 *   - SPEC-DEVIATION: D-106 — misconceptions are listed for every choice and gap question of the current parameters,
 *     in document order, and only for the current content version: a version is raised only by a structural save
 *     (D-093), which may move options or change gaps, and older parameters are not kept, so an older version's
 *     option indices and gap answers cannot be matched to texts (PROD-013). Video engagement only for an
 *     InteractiveVideo (INS-005).
 *   - ImageHotspots sends no learning data: its report says so, with started 0 and no questions (D-115).
 * Collaborators: ./content/questionCatalogue.ts, ./content/activityCapabilities.ts, ./aggregate/*,
 *   ./InsightService.ts.
 * Tests: apps/server/test/insight/thirtyLearners.test.ts, apps/server/test/insight/videoLearners.test.ts,
 *   apps/server/test/insight/insightSuppression.property.test.ts
 */
import type { InsightScope } from '@hvl-interaktiv/api-contract';
import type { MinimumGroupSize } from '../privacy/minimumGroupSize.js';
import { choiceDistribution } from './aggregate/choiceDistribution.js';
import { gapMisconceptions } from './aggregate/gapMisconceptions.js';
import { itemDifficultyInsights } from './aggregate/itemDifficulty.js';
import { answersByItem, learnersOf, type AnswersByItem } from './aggregate/learnerAnswers.js';
import { participationInsight } from './aggregate/participation.js';
import { videoEngagement } from './aggregate/videoEngagement.js';
import { activityCapabilities, videoInteractions } from './content/activityCapabilities.js';
import { questionCatalogue, type CatalogueQuestion } from './content/questionCatalogue.js';
import type { InsightStatement } from './data/insightStatements.js';
import type { InsightReport, MisconceptionInsight } from './insightReport.js';
import { isShowableCount, suppressEveryCell } from './suppression/insightCells.js';

/** Everything one view is built from. */
export interface InsightReportInput {
  /** What the view covers (../scope/insightScope.ts). */
  readonly scope: InsightScope;
  readonly size: MinimumGroupSize;
  /** The main library's machine name, e.g. `H5P.QuestionSet`. */
  readonly mainLibrary: string;
  /** The activity's current parameters. */
  readonly params: unknown;
  /** The view's statements in stored order. */
  readonly statements: readonly InsightStatement[];
  /** The course's NRPS learner count (LTI-008), or undefined for the portal or when none is stored. */
  readonly courseLearners: number | undefined;
}

function misconceptionsOf(
  size: MinimumGroupSize,
  questions: readonly CatalogueQuestion[],
  answers: AnswersByItem,
): MisconceptionInsight[] {
  return questions.flatMap((question): MisconceptionInsight[] => {
    const learners = [...(answers.get(question.item)?.values() ?? [])];
    const { shape } = question;
    if (shape.kind === 'choice') return [choiceDistribution(size, question, shape.options, learners)];
    if (shape.kind === 'gaps') return [gapMisconceptions(size, question, shape, learners)];
    return [];
  });
}

/**
 * Builds one insight view.
 * @param input - The scope, *k*, the activity and the view's statements.
 * @returns The report, every number suppressed below *k* (INS-006).
 * @spec INS-001
 */
export function buildInsightReport(input: InsightReportInput): InsightReport {
  const { size, mainLibrary, params, statements } = input;
  const capabilities = activityCapabilities(mainLibrary, params);
  const questions = questionCatalogue(mainLibrary, params);
  const answers = answersByItem(statements);
  const texts = new Map(questions.map(({ item, text }) => [item, text]));
  const started = learnersOf(statements).size;
  // PRIVACY: a hidden group of starters hides every cell about them (INS-006).
  const within = <T>(part: T): T => (isShowableCount(size, started) ? part : suppressEveryCell(part));
  // SPEC-DEVIATION: D-106 — INS-003 for the current version only: an older version's option indices and gap answers
  // belong to parameters that are no longer stored (D-093).
  const current = input.scope.contentVersion === input.scope.currentVersion;
  return {
    scope: input.scope,
    activity: {
      mainLibrary,
      sendsLearningData: capabilities.sendsStatements,
      sendsRootResult: capabilities.sendsRootResult,
    },
    participation: participationInsight(size, statements, {
      sendsRootResult: capabilities.sendsRootResult,
      courseLearners: input.courseLearners,
    }),
    items: within(itemDifficultyInsights(size, questions, answers)),
    misconceptions: current ? within(misconceptionsOf(size, questions, answers)) : [],
    videoEngagement:
      mainLibrary === 'H5P.InteractiveVideo'
        ? videoEngagement(size, videoInteractions(params), answers, started, texts)
        : null,
  };
}
