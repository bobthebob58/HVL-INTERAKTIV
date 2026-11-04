/**
 * insightReport — the shape of one insight view as the server builds it: participation (INS-001), item difficulty
 * (INS-002), misconceptions (INS-003) and video engagement (INS-005), every number a suppressed or shown cell.
 *
 * Why: the API workstream answers the Innsikt tab and the CSV export (INS-009) from this one shape, so every
 *      aggregate it can send has passed INS-006 before it leaves the insight core, and "not available" (a type that
 *      cannot send the data, D-115) is told apart from "suppressed" (fewer than k learners) by type: null versus a
 *      cell `{ suppressed: true }`.
 * Spec: INS-001, INS-002, INS-003, INS-005, INS-006, PROD-013
 * Invariants:
 *   - PRIVACY: nothing here is about one learner: no learner key, attempt ID, per-learner row or free-text answer
 *     that fewer than k learners gave (INS-006). Every number is a cell from ./suppression/insightCells.ts.
 *   - null means "not available" (never 0): the activity type cannot send it as configured (D-115).
 *   - Texts (question, option, feedback, label, gap answers) are plain text of at most 300 characters, from the
 *     activity's own parameters, except a wrong gap answer, which is the learners' text, trimmed and case-folded,
 *     shown only when at least k learners gave it.
 * Collaborators: @hvl-interaktiv/api-contract (`insight.ts`: the cells and the scope), ./buildInsightReport.ts,
 *   ./InsightService.ts, ./export/insightCsvRows.ts, the API workstream (apps/server/src/insight/http).
 * Tests: apps/server/test/insight/thirtyLearners.test.ts, apps/server/test/insight/insightSuppression.property.test.ts
 */
import type {
  InsightCountCell,
  InsightMedianCell,
  InsightRateCell,
  InsightScope,
} from '@hvl-interaktiv/api-contract';

/** INS-001: who started and completed, the completion rate, the median time on task and attempts. */
export interface ParticipationInsight {
  /** Learners with any stored statement in the view. */
  readonly started: InsightCountCell;
  /** Learners with a stored root result; null when the type cannot send one (D-115). */
  readonly completed: InsightCountCell | null;
  /** Completed over the base below; null when completed is not available. */
  readonly completionRate: InsightRateCell | null;
  /** `course`: the NRPS learner count (LTI-008); `started`: of those who started; null when not available. */
  readonly completionBase: 'course' | 'started' | null;
  /** The course's learner count when it is the base; null otherwise. */
  readonly courseLearners: InsightCountCell | null;
  /** Minutes, one decimal, from each page load's first to last stored statement, summed per learner (D-115). */
  readonly medianMinutesOnTask: InsightMedianCell;
  /** Stored root results per learner who has one; null when the type cannot send one. */
  readonly medianAttempts: InsightMedianCell | null;
}

/** INS-002: one question's difficulty. */
export interface ItemDifficultyInsight {
  /** The `subContentId`, or null for the activity itself (a single question). */
  readonly item: string | null;
  /** The library's machine name, or null for a question the current parameters no longer hold. */
  readonly library: string | null;
  /** Plain text from the parameters, or null when they no longer hold the question. */
  readonly questionText: string | null;
  /** Learners who answered it. */
  readonly learners: InsightCountCell;
  /** Share correct on each learner's first answer; null when its answers cannot be judged. */
  readonly firstCorrect: InsightRateCell | null;
  /** Share correct on each learner's latest answer; null when its answers cannot be judged. */
  readonly latestCorrect: InsightRateCell | null;
}

/** INS-003: one option of a choice question and the learners whose first answer chose it. */
export interface ChoiceOptionInsight {
  /** The option's place in the stored parameters (H5P's `originalOrder`). */
  readonly index: number;
  readonly text: string;
  readonly correct: boolean;
  /** The teacher's feedback for this wrong option; null for a right option or when there is none. */
  readonly feedback: string | null;
  readonly learners: InsightCountCell;
}

/** INS-003: how the first answers to a choice question are distributed. */
export interface ChoiceMisconception {
  readonly kind: 'choice';
  readonly item: string | null;
  readonly questionText: string;
  readonly learners: InsightCountCell;
  readonly options: readonly ChoiceOptionInsight[];
  /** First answers that name no option of the current parameters. */
  readonly noAnswer: InsightCountCell;
}

/** INS-003: a wrong gap answer that at least k learners gave. */
export interface GapWrongAnswer {
  /** Trimmed and case-folded. */
  readonly answer: string;
  readonly learners: InsightCountCell;
}

/** INS-003: the first answers to one gap. */
export interface GapInsight {
  /** The gap's place, from 0. */
  readonly index: number;
  /** The answers the author accepts. */
  readonly correctAnswers: readonly string[];
  readonly correct: InsightCountCell;
  /** At most five, most frequent first. */
  readonly wrongAnswers: readonly GapWrongAnswer[];
  /** Wrong answers not listed (each given by fewer than k learners, or beyond the five). */
  readonly otherWrong: InsightCountCell;
  readonly empty: InsightCountCell;
}

/** INS-003: the gaps of a Blanks or DragText task. */
export interface GapMisconception {
  readonly kind: 'gaps';
  readonly item: string | null;
  readonly questionText: string;
  readonly learners: InsightCountCell;
  readonly gaps: readonly GapInsight[];
}

/** INS-003: one question's misconceptions. */
export type MisconceptionInsight = ChoiceMisconception | GapMisconception;

/** INS-005: one InteractiveVideo interaction. */
export interface VideoInteractionInsight {
  readonly item: string;
  readonly library: string;
  readonly label: string | null;
  readonly questionText: string | null;
  /** Seconds from the start; null for the summary task at the end. */
  readonly atSeconds: number | null;
  /** Learners who answered it. */
  readonly answered: InsightCountCell;
  /** Answered over the learners who started. */
  readonly share: InsightRateCell;
}

/** One insight view, already suppressed. */
export interface InsightReport {
  readonly scope: InsightScope;
  readonly activity: {
    /** The main library's machine name. */
    readonly mainLibrary: string;
    /** False for ImageHotspots: its tab says it sends no learning data (D-115). */
    readonly sendsLearningData: boolean;
    /** False when completed and attempts are not available. */
    readonly sendsRootResult: boolean;
  };
  readonly participation: ParticipationInsight;
  /** Hardest first (lowest shown first-answer share); questions whose share is hidden or unknown last. */
  readonly items: readonly ItemDifficultyInsight[];
  /** INS-003 for the current version only; empty for an older one, whose options and gaps are not stored (D-093). */
  readonly misconceptions: readonly MisconceptionInsight[];
  /** Only for an InteractiveVideo; null otherwise. */
  readonly videoEngagement: readonly VideoInteractionInsight[] | null;
}
