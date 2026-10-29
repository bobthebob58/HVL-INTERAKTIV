/**
 * Tests for the **Læringsdesign** form's rules: the limits mirror the contract, each problem names its field, an
 * empty field is left out of the full-replace body, a control character in the learner purpose becomes a space, and
 * outcome identity is the server's.
 *
 * Spec: PED-030, PED-032
 */
import {
  LEARNER_PURPOSE_MAX_LENGTH,
  MAX_OUTCOMES,
  MAX_STUDENT_MINUTES,
  OUTCOME_MAX_LENGTH,
  RATIONALE_MAX_LENGTH,
} from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import {
  formFrom,
  formProblems,
  MAX_OUTCOMES as FORM_MAX_OUTCOMES,
  MINUTES_MAX,
  OUTCOME_MAX,
  outcomeIdentity,
  PURPOSE_MAX,
  RATIONALE_MAX,
  updateFrom,
  type FormFieldIds,
  type LearningDesignForm,
} from '../../src/features/learningDesign/learningDesignForm';

const IDS: FormFieldIds = {
  courseCode: 'course',
  rationale: 'rationale',
  minutes: 'minutes',
  purpose: 'purpose',
  outcome: (key) => `outcome-${key}`,
};
const EMPTY: LearningDesignForm = formFrom({ outcomes: [], updatedAt: null });
const problemsOf = (change: Partial<LearningDesignForm>) =>
  formProblems({ ...EMPTY, ...change }, IDS, 'nn').map((problem) => problem.fieldId);

describe('[PED-030] the learning-design form', () => {
  it('[PED-030] mirrors the contract’s limits', () => {
    expect([FORM_MAX_OUTCOMES, OUTCOME_MAX, RATIONALE_MAX, MINUTES_MAX, PURPOSE_MAX]).toEqual([
      MAX_OUTCOMES,
      OUTCOME_MAX_LENGTH,
      RATIONALE_MAX_LENGTH,
      MAX_STUDENT_MINUTES,
      LEARNER_PURPOSE_MAX_LENGTH,
    ]);
  });

  it('[PED-030] an empty form has no problems and sends only the outcomes and the updatedAt it read', () => {
    expect(problemsOf({})).toEqual([]);
    expect(updateFrom(EMPTY, null)).toEqual({ outcomes: [], updatedAt: null });
  });

  it.each([
    ['a course code with an underscore', { courseCode: 'SYK_110' }, ['course']],
    [
      'an empty outcome',
      { outcomes: [{ key: 'a', text: ' ', category: 'kunnskap' as const }] },
      ['outcome-a'],
    ],
    [
      'an outcome of 301 characters',
      { outcomes: [{ key: 'b', text: 'x'.repeat(301), category: 'kunnskap' as const }] },
      ['outcome-b'],
    ],
    ['a rationale of 1 001 characters', { rationale: 'x'.repeat(1001) }, ['rationale']],
    ['0 minutes', { minutes: '0' }, ['minutes']],
    ['601 minutes', { minutes: '601' }, ['minutes']],
    ['minutes with a decimal', { minutes: '1,5' }, ['minutes']],
    ['a purpose of 201 characters', { purpose: 'x'.repeat(201) }, ['purpose']],
    ['a purpose on two lines', { purpose: 'Ein\nTo' }, ['purpose']],
  ])('[PED-030] finds %s', (_what, change, fields) => {
    expect(problemsOf(change)).toEqual(fields);
  });

  it('[PED-030] a full form is trimmed and normalised into the body, keeping the outcomes in order', () => {
    // Arrange
    const form: LearningDesignForm = {
      phase: 'etterarbeid',
      courseCode: ' syk 110 ',
      outcomes: [
        { key: 'a', text: ' Måle puls ', category: 'ferdigheiter' },
        { key: 'b', text: 'Forklare', category: 'kunnskap' },
      ],
      rationale: '  Fordi.  ',
      minutes: ' 15 ',
      purpose: ' Du øver. ',
    };
    // Act
    const body = updateFrom(form, '2026-10-29T10:00:00.000Z');
    // Assert
    expect(problemsOf(form)).toEqual([]);
    expect(body).toEqual({
      phase: 'etterarbeid',
      courseCode: 'SYK110',
      outcomes: [
        { text: 'Måle puls', category: 'ferdigheiter' },
        { text: 'Forklare', category: 'kunnskap' },
      ],
      rationale: 'Fordi.',
      estimatedStudentMinutes: 15,
      learnerPurpose: 'Du øver.',
      updatedAt: '2026-10-29T10:00:00.000Z',
    });
  });

  it('[PED-032] a tab or other control character in the purpose becomes a space, so the launch can carry it', () => {
    // Arrange
    const form = { ...EMPTY, purpose: '\tDu øver\tfør\u0007samlinga. ' };
    // Act
    const body = updateFrom(form, null);
    // Assert
    expect(problemsOf(form)).toEqual([]);
    expect(body.learnerPurpose).toBe('Du øver før samlinga.');
    expect(body.learnerPurpose).not.toMatch(/\p{Cc}/u);
  });

  it('[PED-030] outcome identity ignores spacing and case but not the category', () => {
    const typed = { text: 'Forklare  Blodtrykk ', category: 'kunnskap' as const };
    expect(outcomeIdentity(typed)).toBe(
      outcomeIdentity({ text: 'forklare blodtrykk', category: 'kunnskap' }),
    );
    expect(outcomeIdentity(typed)).not.toBe(outcomeIdentity({ ...typed, category: 'ferdigheiter' }));
  });
});
