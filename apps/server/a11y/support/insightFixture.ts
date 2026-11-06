/**
 * insightFixture — the insight view the accessibility suites show on the «Innsikt» tab: participation, three questions
 * (one hidden below k), a choice question and a gap task, for a period of the last 7 days or one shortened to start
 * on 1 August.
 *
 * Why: UD-030 scans every view in the state a person meets it in, and the Innsikt tab (INS-001…INS-010, INS-008) has
 *      charts, tables, «< k» cells, period notes and a shortlist only once a view has data. One fixed, already
 *      suppressed view gives every kind of section whatever the clock and the stored learners; ./insightViews.ts
 *      answers the tab's requests with it.
 * Spec: UD-030, INS-008, INS-006, PROD-010
 * Invariants:
 *   - The answer has the shape of apps/web/src/features/insight/insightReportShape.ts; a suppressed cell carries no
 *     value (INS-006), as the server's would.
 *   - The shortened period is a 30-day view on 13 August 2026 that the server started on 1 August (D-106's
 *     amendment of 2026-11-04), so the tab shows both period notes.
 * Collaborators: ./insightViews.ts, ../axeInsight.a11y.test.ts, ../keyboardJourneys.a11y.test.ts.
 * Tests: apps/server/a11y/axeInsight.a11y.test.ts
 */

/** A view's period, start and end, as the server's scope gives them. */
export interface InsightViewPeriod {
  readonly period: '7d' | '14d' | '30d' | 'semester';
  readonly periodStart: string;
  readonly periodEnd: string;
}

/** The default period: the last 7 days, up to midnight Oslo time on 4 November 2026. */
export const LAST_SEVEN_DAYS: InsightViewPeriod = {
  period: '7d',
  periodStart: '2026-10-27T23:00:00.000Z',
  periodEnd: '2026-11-03T23:00:00.000Z',
};

/** A 30-day view on 13 August 2026, shortened to start at midnight Oslo time on 1 August (D-106). */
export const SHORTENED_PERIOD: InsightViewPeriod = {
  period: '30d',
  periodStart: '2026-07-31T22:00:00.000Z',
  periodEnd: '2026-08-12T22:00:00.000Z',
};

/** The view's first question, a choice question (`q1`). */
export const FIRST_QUESTION = 'Kva gjer mitokondriane?';

/** The view's second question, a gap task (`q2`), which journey J3 takes to the seminar (spec 00 §3). */
export const SECOND_QUESTION = 'Fyll inn namnet på organellen.';

/** A value shown, and one hidden below k (INS-006). */
const shown = (value: number) => ({ suppressed: false, value });
const HIDDEN = { suppressed: true };

/**
 * The view the routed API answers.
 * @param contentId - The activity.
 * @param context - The context the view covers.
 * @param period - The view's period, start and end: by default the last 7 days to 4 November 2026.
 * @returns The insight answer.
 */
export function insightView(
  contentId: string,
  context: { key: string; label: string | null },
  period: InsightViewPeriod = LAST_SEVEN_DAYS,
) {
  const question = FIRST_QUESTION;
  return {
    scope: { contentId, contentVersion: 2, currentVersion: 2, context, ...period, k: 5 },
    activity: { mainLibrary: 'H5P.QuestionSet', sendsLearningData: true, sendsRootResult: true },
    participation: {
      started: shown(24),
      completed: shown(18),
      completionRate: shown(0.75),
      completionBase: 'started',
      courseLearners: null,
      medianMinutesOnTask: shown(4.5),
      medianAttempts: shown(1.5),
    },
    items: [
      {
        item: 'q1',
        library: 'H5P.MultiChoice',
        questionText: question,
        learners: shown(20),
        firstCorrect: shown(0.4),
        latestCorrect: shown(0.65),
      },
      {
        item: 'q2',
        library: 'H5P.Blanks',
        questionText: SECOND_QUESTION,
        learners: shown(19),
        firstCorrect: shown(10 / 19),
        latestCorrect: shown(15 / 19),
      },
      {
        item: 'q3',
        library: 'H5P.TrueFalse',
        questionText: 'Celler har kjerne.',
        learners: HIDDEN,
        firstCorrect: HIDDEN,
        latestCorrect: HIDDEN,
      },
    ],
    misconceptions: [
      {
        kind: 'choice',
        item: 'q1',
        questionText: question,
        learners: shown(20),
        options: [
          { index: 0, text: 'Lagar energi', correct: true, feedback: null, learners: shown(8) },
          {
            index: 1,
            text: 'Lagrar arvestoff',
            correct: false,
            feedback: 'Arvestoffet ligg i cellekjernen.',
            learners: shown(9),
          },
          { index: 2, text: 'Byggjer protein', correct: false, feedback: null, learners: HIDDEN },
        ],
        noAnswer: HIDDEN,
      },
      {
        kind: 'gaps',
        item: 'q2',
        questionText: SECOND_QUESTION,
        learners: shown(19),
        gaps: [
          {
            index: 0,
            correctAnswers: ['mitokondrie', 'mitokondria'],
            correct: shown(10),
            wrongAnswers: [{ answer: 'ribosom', learners: shown(6) }],
            otherWrong: HIDDEN,
            // PRIVACY: the server hides the 0 too, so «Andre feil svar» cannot be worked out (INS-006)
            empty: HIDDEN,
          },
        ],
      },
    ],
    videoEngagement: null,
  };
}
