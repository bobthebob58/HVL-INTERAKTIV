/**
 * seminarCohort — a course of Canvas learners who answer the run author's QuestionSet (the real example: a
 * single-answer MultiChoice, a Blanks with three gaps, a DragText and a multi-answer MultiChoice) through the server's
 * real ingestion route, each with the first question's option and the third gap's word this test gives them; and the
 * texts of the stored activity that the teacher's Innsikt tab shows back.
 *
 * Why: journey J3 (spec 00 §3) has the teacher read a class's answers before the seminar: who started and completed,
 *      the share right on the first try, the option most of them chose with the teacher's own feedback beside it, and
 *      no cell about fewer than *k* learners (INS-001…INS-003, INS-006). A class of 13 is too many to play one by one
 *      in Chromium; the bridge's own path is proved by the browser learners of ./gradeBridgeFlow.ts and
 *      ./insightFlow.ts, and these learners take everything after it for real (../../test/support/insightLearners.ts).
 * Spec: INS-001, INS-002, INS-003, INS-006, LTI-011
 * Invariants:
 *   - The sub-content IDs and texts are read from the stored activity, never written here, so the flow follows the
 *     real example; only the answers are the test's.
 *   - Each learner is a new Canvas user with the student roles and no name (DATA-012); the first two gaps are answered
 *     as probe P1 recorded them (right), the third with the given word, so the Blanks score is 2 of 3.
 * Collaborators: ../../test/support/insightLearners.ts, ../../test/support/realWebApp.ts,
 *   ../journeySeminarInsight.e2e.test.ts.
 * Tests: apps/server/e2e/journeySeminarInsight.e2e.test.ts
 */
import type { LaunchSpec } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { newCanvasLearner, playThroughIngestion } from '../../test/support/insightLearners.js';
import type { RealWebApp } from '../../test/support/realWebApp.js';

/** What one learner of the cohort answers. */
export interface CohortAnswer {
  /** The option of the first question, by its stored position (0 is the right one in the example). */
  readonly option: number;
  /** The word written in the Blanks question's third gap. */
  readonly thirdGap: string;
}

/** The QuestionSet's texts as the Innsikt tab shows them. */
export interface QuestionSetTexts {
  /** The first question's text. */
  readonly first: string;
  /** Its options' texts, in stored order. */
  readonly options: readonly string[];
  /** The feedback the teacher wrote for each option, in stored order. */
  readonly feedback: readonly string[];
  /** The Blanks question's text (its section heading on the tab). */
  readonly blanks: string;
}

type StoredQuestion = {
  subContentId: string;
  params: {
    question?: string;
    text?: string;
    answers?: { text: string; tipsAndFeedback?: { chosenFeedback?: string } }[];
  };
};

/** Text without its HTML tags, as the Innsikt tab shows a question or option. */
const plain = (html: string | undefined): string => (html ?? '').replace(/<[^>]+>/g, '').trim();

/** The stored questions of the activity. */
async function storedQuestions(app: RealWebApp, contentId: string): Promise<StoredQuestion[]> {
  const { params } = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
  return (params as { questions: StoredQuestion[] }).questions;
}

/**
 * The texts of the first question, read from the stored activity.
 * @param app - The running app.
 * @param contentId - The QuestionSet.
 * @returns The question, its options and the teacher's feedback for each, and the Blanks question's text.
 */
export async function questionSetTexts(app: RealWebApp, contentId: string): Promise<QuestionSetTexts> {
  const [first, blanks] = await storedQuestions(app, contentId);
  const answers = first?.params.answers ?? [];
  return {
    first: plain(first?.params.question),
    options: answers.map((answer) => plain(answer.text)),
    feedback: answers.map((answer) => plain(answer.tipsAndFeedback?.chosenFeedback)),
    blanks: plain(blanks?.params.text),
  };
}

/**
 * Every learner of the cohort launches from the mock Canvas into the course and posts one page load's statements.
 * @param app - The running app.
 * @param launchOf - The launch of one learner, given the user.
 * @param contentId - The QuestionSet.
 * @param answers - One entry per learner.
 * @returns The ingestion's status for each learner (202 when stored).
 */
export async function answerAsCohort(
  app: RealWebApp,
  launchOf: (user: NonNullable<LaunchSpec['user']>) => LaunchSpec & { custom: { contentId: string } },
  contentId: string,
  answers: readonly CohortAnswer[],
): Promise<number[]> {
  const [first, blanks] = (await storedQuestions(app, contentId)).map((question) => question.subContentId);
  const statuses: number[] = [];
  for (const answer of answers) {
    const status = await playThroughIngestion(app, launchOf(newCanvasLearner()), 'H5P.QuestionSet', (id) => {
      if (id === first) return { response: String(answer.option), raw: answer.option === 0 ? 1 : 0 };
      if (id === blanks) return { response: `undervegsvurdering[,]framover[,]${answer.thirdGap}`, raw: 2 };
      return undefined;
    });
    statuses.push(status);
  }
  return statuses;
}
