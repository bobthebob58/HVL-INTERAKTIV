/**
 * insightAnswers — the insight API answers the Innsikt tab tests fake: the routes, a question set seen in the portal
 * with shown, suppressed and unavailable values, the contexts, and the cells and text helpers the tests share. The
 * other views (a video, ImageHotspots, an empty period) and the findings are in ./insightOtherAnswers.ts.
 *
 * Why: the panel, chart, misconception, shortlist and CSV tests (INS-001…INS-010) read the same views; one module keeps
 *      the answer's shape (../../../src/features/insight/insightReportShape.ts) and the test texts in one place. Every
 *      suppressed cell is `{ suppressed: true }` with no value, as the contract has it (INS-006), so a test can assert
 *      that no hidden number reaches the page.
 * Spec: INS-001, INS-002, INS-003, INS-005, INS-006
 * Collaborators: ./insightOtherAnswers.ts, ../../support/fakeFetch.ts, packages/api-contract (types only).
 * Tests: used by the tests in this folder.
 */
import type { InsightContext, InsightScope } from '@hvl-interaktiv/api-contract';
import type { InsightReport } from '../../../src/features/insight/insightReportShape';

/** The activity's ID. */
export const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
/** The first view the portal asks for. */
export const PORTAL_PATH = `/api/content/${ID}/insight?period=7d&context=portal`;
/** The first view Canvas asks for (the launch fixes the context). */
export const CANVAS_PATH = `/api/content/${ID}/insight?period=7d`;
/** The activity's contexts. */
export const CONTEXTS_PATH = `/api/content/${ID}/insight/contexts`;
/** The validator's findings. */
export const FINDINGS_PATH = `/api/content/${ID}/findings`;
/** A Canvas course of the activity (D-103). */
export const SYK_KEY = '0192f0c4-0000-7000-8000-0000000000a1:course-17';

/** Shown and suppressed cells. */
export const shown = (value: number) => ({ suppressed: false as const, value });
/** The suppressed cell: no value at all. */
export const HIDDEN = { suppressed: true as const };

/** The contexts: the portal, SYK110 and a course without a label. */
export const CONTEXTS: readonly InsightContext[] = [
  { key: 'portal', label: null },
  { key: SYK_KEY, label: 'SYK110' },
  { key: '0192f0c4-0000-7000-8000-0000000000b2:course-9', label: null },
];

/**
 * The scope of a view.
 * @param overrides - Fields to change.
 * @returns The portal, the last 7 days, version 3 of 3, k = 5.
 */
export const scope = (overrides: Partial<InsightScope> = {}): InsightScope => ({
  contentId: ID,
  contentVersion: 3,
  currentVersion: 3,
  context: { key: 'portal', label: null },
  period: '7d',
  periodStart: '2026-10-27T23:00:00.000Z',
  periodEnd: '2026-11-03T12:00:00.000Z',
  k: 5,
  ...overrides,
});

/** A question set in the portal: three questions, a choice and a gap task, values shown and hidden. */
export const REPORT: InsightReport = {
  scope: scope(),
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
      item: 'q-cell',
      library: 'H5P.MultiChoice',
      questionText: 'Kva gjer mitokondriane?',
      learners: shown(20),
      firstCorrect: shown(0.4),
      latestCorrect: shown(0.65),
    },
    {
      item: 'q-gap',
      library: 'H5P.Blanks',
      questionText: 'Fyll inn namnet på organellen.',
      learners: shown(19),
      firstCorrect: shown(10 / 19),
      latestCorrect: shown(15 / 19),
    },
    {
      item: 'q-old',
      library: null,
      questionText: null,
      learners: HIDDEN,
      firstCorrect: HIDDEN,
      latestCorrect: HIDDEN,
    },
  ],
  misconceptions: [
    {
      kind: 'choice',
      item: 'q-cell',
      questionText: 'Kva gjer mitokondriane?',
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
      item: 'q-gap',
      questionText: 'Fyll inn namnet på organellen.',
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

/**
 * Collapses the narrow and ordinary no-break spaces `Intl` writes, so texts compare as typed.
 * @param text - A text from the page.
 * @returns The text with ordinary spaces.
 */
export const plain = (text: string | null | undefined): string =>
  (text ?? '').replace(/[\u00a0\u202f]/g, ' ');
