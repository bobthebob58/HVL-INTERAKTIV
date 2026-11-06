/**
 * videoEngagement — INS-005 for an InteractiveVideo: per answerable interaction, in playing order, how many of the
 * learners who started answered it, and their share.
 *
 * Why: InteractiveVideo sends no `progressed` statement (probe P1), so there is no drop-off curve; the share of
 *      learners who answered each interaction is the measure INS-005 allows, a proxy for how far they watched (D-115).
 *      The interactions come from the parameters, so one that nobody reached is listed too.
 * Spec: INS-005, INS-006
 * Invariants:
 *   - A learner answered an interaction when they have at least one stored `answered` for its `subContentId`; the
 *     share's base is the learners who started the activity in the view (INS-001's started).
 *   - PRIVACY: a count of 1 to k − 1 is suppressed, and so is its share, which would reveal it; when the learners who
 *     started are suppressed, everything is (INS-006).
 * Collaborators: ./learnerAnswers.ts, ../content/activityCapabilities.ts, ../suppression/insightCells.ts,
 *   ../buildInsightReport.ts.
 * Tests: apps/server/test/insight/videoLearners.test.ts, apps/server/test/insight/insightSuppression.property.test.ts
 */
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import type { VideoInteraction } from '../content/activityCapabilities.js';
import type { VideoInteractionInsight } from '../insightReport.js';
import {
  countCell,
  isShowableCount,
  rateCell,
  SUPPRESSED_CELL,
  withinShownGroup,
} from '../suppression/insightCells.js';
import type { AnswersByItem } from './learnerAnswers.js';

/**
 * INS-005's list.
 * @param size - The minimum group size.
 * @param interactions - The video's answerable interactions in playing order.
 * @param answers - Each question's learners with their answers.
 * @param started - The learners who started the activity in the view.
 * @param questionTexts - The question text per interaction, from the catalogue.
 * @returns One entry per interaction.
 * @spec INS-005
 */
export function videoEngagement(
  size: MinimumGroupSize,
  interactions: readonly VideoInteraction[],
  answers: AnswersByItem,
  started: number,
  questionTexts: ReadonlyMap<string | null, string>,
): VideoInteractionInsight[] {
  const startedShown = isShowableCount(size, started);
  return interactions.map((interaction) => {
    const answered = answers.get(interaction.item)?.size ?? 0;
    const count = withinShownGroup(countCell(size, answered), startedShown);
    // PRIVACY: the share times the learners who started gives the count, so it is hidden whenever the count is.
    const share = count.suppressed ? SUPPRESSED_CELL : rateCell(size, answered / started, started);
    const text = questionTexts.get(interaction.item);
    return {
      item: interaction.item,
      library: interaction.library,
      label: interaction.label,
      questionText: text === undefined || text === '' ? null : text,
      atSeconds: interaction.atSeconds,
      answered: count,
      share,
    };
  });
}
