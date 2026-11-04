/**
 * Tests the insight answers: one view (INS-001…INS-005) with shown, suppressed and not-available values, the contexts
 * list, and the findings with an acknowledgement whose reason is withheld from readers who may not edit.
 *
 * Spec: INS-001, INS-003, INS-006, INS-007, INS-010
 */
import { describe, expect, it } from 'vitest';
import {
  insightContextsResponseSchema,
  insightFindingsResponseSchema,
  insightReportSchema,
} from '../src/index.js';

const PLATFORM = '0192f0c4-0000-7000-8000-00000000aaaa';
const hidden = { suppressed: true } as const;
const shown = (value: number) => ({ suppressed: false, value }) as const;

const report = () => ({
  scope: {
    contentId: '0192f0c4-0000-7000-8000-000000000001',
    contentVersion: 2,
    currentVersion: 2,
    context: { key: `${PLATFORM}:course-1`, label: 'SYK110' },
    period: '7d',
    periodStart: '2026-10-27T23:00:00.000Z',
    periodEnd: '2026-11-04T12:00:00.000Z',
    k: 5,
  },
  activity: { mainLibrary: 'H5P.MultiChoice', sendsLearningData: true, sendsRootResult: true },
  participation: {
    started: shown(12),
    completed: shown(9),
    completionRate: shown(0.75),
    completionBase: 'started',
    courseLearners: null,
    medianMinutesOnTask: shown(4.5),
    medianAttempts: shown(1),
  },
  items: [
    {
      item: null,
      library: 'H5P.MultiChoice',
      questionText: 'Kva er ei celle?',
      learners: shown(12),
      firstCorrect: shown(0.5),
      latestCorrect: shown(0.75),
    },
  ],
  misconceptions: [
    {
      kind: 'choice',
      item: null,
      questionText: 'Kva er ei celle?',
      learners: shown(12),
      options: [
        { index: 0, text: 'Ei eining', correct: true, feedback: null, learners: shown(6) },
        {
          index: 1,
          text: 'Eit organ',
          correct: false,
          feedback: 'Nei, eit organ har mange.',
          learners: shown(5),
        },
        { index: 2, text: 'Ein stein', correct: false, feedback: null, learners: hidden },
      ],
      noAnswer: hidden,
    },
  ],
  videoEngagement: null,
});

describe('[INS-001] the insight view', () => {
  it('[INS-001] a view with shown, suppressed and not-available values matches the contract', () => {
    // Arrange
    const withNotAvailable = { ...report(), participation: { ...report().participation, completed: null } };
    // Act and assert
    expect(insightReportSchema.safeParse(report()).success).toBe(true);
    expect(insightReportSchema.safeParse(withNotAvailable).success).toBe(true);
  });

  it('[INS-006] a suppressed value that carries its number, or any field the contract does not name, is refused', () => {
    // Arrange
    const leaky = report();
    const withValue = {
      ...leaky,
      participation: { ...leaky.participation, started: { suppressed: true, value: 3 } },
    };
    const withLearner = { ...leaky, items: [{ ...leaky.items[0], learnerKeys: ['lk-1'] }] };
    const withRows = { ...leaky, rows: [{ learner: 'lk-1', score: 1 }] };
    // Act and assert
    for (const body of [withValue, withLearner, withRows])
      expect(insightReportSchema.safeParse(body).success).toBe(false);
  });

  it('[INS-003] a gap lists at most five wrong answers', () => {
    // Arrange
    const gap = (wrong: number) => ({
      ...report(),
      misconceptions: [
        {
          kind: 'gaps',
          item: 'gap-task',
          questionText: 'Fyll inn',
          learners: shown(30),
          gaps: [
            {
              index: 0,
              correctAnswers: ['celle'],
              correct: shown(10),
              wrongAnswers: Array.from({ length: wrong }, (_, i) => ({
                answer: `svar ${i}`,
                learners: shown(5),
              })),
              otherWrong: hidden,
              empty: shown(0),
            },
          ],
        },
      ],
    });
    // Act and assert
    expect(insightReportSchema.safeParse(gap(5)).success).toBe(true);
    expect(insightReportSchema.safeParse(gap(6)).success).toBe(false);
  });
});

describe('[INS-007] the contexts and [INS-010] the findings', () => {
  it('[INS-007] a context carries its key and label only, never a count', () => {
    // Act and assert
    expect(
      insightContextsResponseSchema.safeParse({
        contexts: [
          { key: 'portal', label: null },
          { key: `${PLATFORM}:course-1`, label: 'SYK110' },
        ],
      }).success,
    ).toBe(true);
    expect(
      insightContextsResponseSchema.safeParse({ contexts: [{ key: 'portal', label: null, learners: 3 }] })
        .success,
    ).toBe(false);
  });

  it('[INS-010] a finding’s acknowledgement may come without its reason, and never names who gave it', () => {
    // Arrange
    const finding = (reason: string | null, extra: object = {}) => ({
      updatedAt: '2026-11-04T10:00:00.000Z',
      findings: [
        {
          ruleId: 'V-IMG-ALT',
          severity: 'error',
          requirement: 'UD-021',
          path: 'media.alt',
          message: 'Bildet manglar alternativ tekst.',
          acknowledgement: {
            reason,
            at: '2026-11-01T10:00:00.000Z',
            expiresAt: '2026-11-15T10:00:00.000Z',
            ...extra,
          },
        },
      ],
    });
    // Act and assert
    expect(insightFindingsResponseSchema.safeParse(finding('Bildet er pynt.')).success).toBe(true);
    expect(insightFindingsResponseSchema.safeParse(finding(null)).success).toBe(true);
    expect(insightFindingsResponseSchema.safeParse(finding(null, { userId: 'u-1' })).success).toBe(false);
  });
});
