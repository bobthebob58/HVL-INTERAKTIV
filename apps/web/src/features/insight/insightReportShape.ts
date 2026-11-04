/**
 * insightReportShape — the shape of one insight answer as the Innsikt tab reads it: the scope, participation
 * (INS-001), item difficulty (INS-002), misconceptions (INS-003) and video engagement (INS-005), every number a shown
 * or suppressed cell from the contract, and the list of contexts an activity can be viewed for.
 *
 * Why: the tab is built against packages/api-contract/src/insight.ts (its cells, scope and contexts), while the
 *      answer's full shape is still being added there by the API workstream (S6 step 4). Until it is, this file
 *      mirrors apps/server/src/insight/insightReport.ts field for field, under the same names, so the swap is one
 *      import per file. "Not available" (a type that cannot send the data, D-115) is `null`; "suppressed" (fewer than
 *      k learners, INS-006) is a cell `{ suppressed: true }` with no value.
 * Spec: INS-001, INS-002, INS-003, INS-005, INS-006, INS-007, PROD-013
 * Invariants:
 *   - Types only: nothing here reaches the browser bundle, and only `import type` comes from the contract.
 *   - PRIVACY: no shape has a learner key, attempt ID or per-learner row; the tab cannot show what is not here.
 * Collaborators: @hvl-interaktiv/api-contract (`insight.ts`), apps/server/src/insight/insightReport.ts (the
 *   server's shape), ./insightApi.ts, the sections in this folder.
 * Tests: apps/web/test/features/insight/insightAnswers.ts (fixtures typed by it),
 *   apps/web/test/features/insight/InsightPanel.test.tsx
 */
import type {
  InsightContext,
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
  /** Minutes, one decimal, summed per learner from each page load's first to last stored statement (D-115). */
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
  /** The option's place in the stored parameters. */
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

/** INS-003: a wrong gap answer that at least k learners gave, trimmed and case-folded. */
export interface GapWrongAnswer {
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

/** One insight view, already suppressed by the server. */
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
  /** Hardest first; questions whose share is hidden or unknown last. */
  readonly items: readonly ItemDifficultyInsight[];
  /** Empty for a content version older than the current one: its options may have changed (D-093, D-106). */
  readonly misconceptions: readonly MisconceptionInsight[];
  /** Only for an InteractiveVideo; null otherwise. */
  readonly videoEngagement: readonly VideoInteractionInsight[] | null;
}

/** The contexts an activity's insight can be shown for: the portal first, then each Canvas course (INS-007). */
export interface InsightContextsResponse {
  readonly contexts: readonly InsightContext[];
}
