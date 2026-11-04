/**
 * insightReport — the answer of one insight view (`GET /api/content/:contentId/insight`): participation (INS-001),
 * item difficulty (INS-002), misconceptions (INS-003) and video engagement (INS-005), each number a shown or
 * suppressed cell.
 *
 * Why: the Innsikt tab (D-101, D-106) and the CSV export (INS-009) read one already suppressed answer; describing it
 *      here lets the OpenAPI document show it (DOC-012), the server check its own answer against it in tests, and the
 *      web app type the tab from it. "Not available" (an activity type that cannot send the data, D-115) is `null`;
 *      "suppressed" (fewer than k learners, INS-006) is the cell `{ suppressed: true }`, so the two never mix.
 * Spec: INS-001, INS-002, INS-003, INS-005, INS-006, PROD-013
 * Invariants:
 *   - Mirrors apps/server/src/insight/insightReport.ts field for field; the server's API tests parse every answer of
 *     the view with `insightReportSchema`, including the property test's random datasets.
 *   - PRIVACY: no shape has a learner key, attempt ID, account or per-learner row (INS-006); every number is a cell
 *     from ./insight.ts, so a hidden value travels without its number.
 *   - Objects are strict: a field the contract does not name is refused, so nothing extra can leak through the API.
 * Collaborators: ./insight.ts (cells and scope), ./routes/insightRoutes.ts, apps/server/src/insight/insightReport.ts,
 *   apps/server/src/insight/http/insightRoutes.ts, apps/web/src/features/insight/.
 * Tests: packages/api-contract/test/insightReportSchemas.test.ts
 */
import { z } from 'zod';
import {
  insightCountCellSchema,
  insightMedianCellSchema,
  insightRateCellSchema,
  insightScopeSchema,
} from './insight.js';

/** INS-001: who started and completed, the completion rate, and the median time on task and attempts. */
export const participationInsightSchema = z.strictObject({
  started: insightCountCellSchema,
  /** Null when the activity type cannot send a root result (D-115). */
  completed: insightCountCellSchema.nullable(),
  completionRate: insightRateCellSchema.nullable(),
  /** `course`: of the NRPS learner count (LTI-008); `started`: of those who started; null when not available. */
  completionBase: z.enum(['course', 'started']).nullable(),
  courseLearners: insightCountCellSchema.nullable(),
  /** Minutes, one decimal, from each page load's first to last stored statement (D-115). */
  medianMinutesOnTask: insightMedianCellSchema,
  medianAttempts: insightMedianCellSchema.nullable(),
});
/** Participation. */
export type ParticipationInsightResponse = z.infer<typeof participationInsightSchema>;

/** INS-002: one question's difficulty. */
export const itemDifficultySchema = z.strictObject({
  /** The `subContentId`, or null for the activity itself (a single question). */
  item: z.string().nullable(),
  library: z.string().nullable(),
  /** Plain text from the current parameters; null when they no longer hold the question. */
  questionText: z.string().nullable(),
  learners: insightCountCellSchema,
  firstCorrect: insightRateCellSchema.nullable(),
  latestCorrect: insightRateCellSchema.nullable(),
});
/** One question's difficulty. */
export type ItemDifficultyResponse = z.infer<typeof itemDifficultySchema>;

/** INS-003: one option of a choice question and the learners whose first answer chose it. */
export const choiceOptionSchema = z.strictObject({
  index: z.int().min(0),
  text: z.string(),
  correct: z.boolean(),
  /** The teacher's own feedback for a wrong option; null for a right one or when there is none. */
  feedback: z.string().nullable(),
  learners: insightCountCellSchema,
});
/** One option. */
export type ChoiceOptionResponse = z.infer<typeof choiceOptionSchema>;

/** INS-003: a wrong gap answer that at least k learners gave, trimmed and case-folded. */
export const gapWrongAnswerSchema = z.strictObject({ answer: z.string(), learners: insightCountCellSchema });
/** A wrong gap answer. */
export type GapWrongAnswerResponse = z.infer<typeof gapWrongAnswerSchema>;

/** INS-003: the first answers to one gap. */
export const gapInsightSchema = z.strictObject({
  index: z.int().min(0),
  correctAnswers: z.array(z.string()),
  correct: insightCountCellSchema,
  /** At most five, most frequent first. */
  wrongAnswers: z.array(gapWrongAnswerSchema).max(5),
  otherWrong: insightCountCellSchema,
  empty: insightCountCellSchema,
});
/** One gap. */
export type GapInsightResponse = z.infer<typeof gapInsightSchema>;

/** INS-003: one question's misconceptions, a choice distribution or the gaps of a Blanks or DragText task. */
export const misconceptionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('choice'),
    item: z.string().nullable(),
    questionText: z.string(),
    learners: insightCountCellSchema,
    options: z.array(choiceOptionSchema),
    noAnswer: insightCountCellSchema,
  }),
  z.strictObject({
    kind: z.literal('gaps'),
    item: z.string().nullable(),
    questionText: z.string(),
    learners: insightCountCellSchema,
    gaps: z.array(gapInsightSchema),
  }),
]);
/** One question's misconceptions. */
export type MisconceptionResponse = z.infer<typeof misconceptionSchema>;

/** INS-005: one InteractiveVideo interaction and the share of learners who answered it. */
export const videoInteractionSchema = z.strictObject({
  item: z.string(),
  library: z.string(),
  label: z.string().nullable(),
  questionText: z.string().nullable(),
  /** Seconds from the start; null for the summary task at the end. */
  atSeconds: z.number().min(0).nullable(),
  answered: insightCountCellSchema,
  share: insightRateCellSchema,
});
/** One video interaction. */
export type VideoInteractionResponse = z.infer<typeof videoInteractionSchema>;

/**
 * `GET /api/content/:contentId/insight` → 200: one view of one activity, version, context and period, already
 * suppressed (INS-006).
 * @spec INS-001
 */
export const insightReportSchema = z.strictObject({
  scope: insightScopeSchema,
  activity: z.strictObject({
    mainLibrary: z.string(),
    /** False for ImageHotspots: the tab says it sends no learning data (D-115). */
    sendsLearningData: z.boolean(),
    /** False when completed and attempts are not available. */
    sendsRootResult: z.boolean(),
  }),
  participation: participationInsightSchema,
  /** Hardest first; questions whose share is hidden or unknown last. */
  items: z.array(itemDifficultySchema),
  /** For the current version only; empty for an older one (D-093). */
  misconceptions: z.array(misconceptionSchema),
  /** Only for an InteractiveVideo; null otherwise. */
  videoEngagement: z.array(videoInteractionSchema).nullable(),
});
/** One insight view. */
export type InsightReportResponse = z.infer<typeof insightReportSchema>;
