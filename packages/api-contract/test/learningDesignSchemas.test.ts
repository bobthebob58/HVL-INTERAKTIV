/**
 * Tests the learning-design shapes: metadata limits and the full-replace body, course-code normalisation, the
 * planner grid, the create-from-pattern request, and the learner info that activity summaries may carry.
 *
 * Spec: PED-030, PED-031, PED-032, PROD-001
 */
import { describe, expect, it } from 'vitest';
import {
  contentSummarySchema,
  courseCodeSchema,
  LEARNER_PURPOSE_MAX_LENGTH,
  learnerInfoSchema,
  learningDesignSchema,
  learningDesignUpdateSchema,
  MAX_OUTCOMES,
  OUTCOME_MAX_LENGTH,
  patternActivityRequestSchema,
  plannerSchema,
  RATIONALE_MAX_LENGTH,
} from '../src/index.js';

const at = '2026-10-28T12:00:00.000Z';
const outcome = { text: 'Forklare blodtrykksregulering', category: 'kunnskap' } as const;
const update = { updatedAt: null, outcomes: [outcome] };
const accepts = (patch: object) => learningDesignUpdateSchema.safeParse({ ...update, ...patch }).success;

describe('[PED-030] learning-design metadata', () => {
  it('[PED-030] the limits hold: 20 outcomes of 1–300 characters, a rationale of 1 000, 1–600 minutes', () => {
    // Act and assert
    expect(accepts({ outcomes: Array.from({ length: MAX_OUTCOMES }, () => outcome) })).toBe(true);
    expect(accepts({ outcomes: Array.from({ length: MAX_OUTCOMES + 1 }, () => outcome) })).toBe(false);
    expect(accepts({ outcomes: [{ ...outcome, text: 'x'.repeat(OUTCOME_MAX_LENGTH) }] })).toBe(true);
    expect(accepts({ outcomes: [{ ...outcome, text: 'x'.repeat(OUTCOME_MAX_LENGTH + 1) }] })).toBe(false);
    expect(accepts({ outcomes: [{ ...outcome, text: '   ' }] })).toBe(false);
    expect(accepts({ outcomes: [{ ...outcome, category: 'generell_kompetanse' }] })).toBe(false);
    expect(accepts({ rationale: 'x'.repeat(RATIONALE_MAX_LENGTH) })).toBe(true);
    expect(accepts({ rationale: 'x'.repeat(RATIONALE_MAX_LENGTH + 1) })).toBe(false);
    expect(accepts({ rationale: '' })).toBe(false);
    for (const minutes of [1, 600]) expect(accepts({ estimatedStudentMinutes: minutes })).toBe(true);
    for (const minutes of [0, 601, 1.5, '10'])
      expect(accepts({ estimatedStudentMinutes: minutes })).toBe(false);
  });

  it('[PED-032] the learner purpose is one trimmed line of at most 200 characters', () => {
    // Act
    const trimmed = learningDesignUpdateSchema.parse({
      ...update,
      learnerPurpose: '  Du øver før samlinga.  ',
    });
    // Assert
    expect(trimmed.learnerPurpose).toBe('Du øver før samlinga.');
    expect(accepts({ learnerPurpose: 'x'.repeat(LEARNER_PURPOSE_MAX_LENGTH) })).toBe(true);
    expect(accepts({ learnerPurpose: 'x'.repeat(LEARNER_PURPOSE_MAX_LENGTH + 1) })).toBe(false);
    expect(accepts({ learnerPurpose: 'Første linje\nAndre linje' })).toBe(false);
    expect(accepts({ learnerPurpose: 'Ein\tto' })).toBe(false);
    expect(accepts({ learnerPurpose: 'Ein\u0007to' })).toBe(false);
  });

  it('[PED-030] a PUT replaces everything, needs the updatedAt it read and refuses the read-only patternId', () => {
    // Act and assert
    expect(accepts({ updatedAt: at, phase: 'underveis', courseCode: 'SYK110' })).toBe(true);
    expect(learningDesignUpdateSchema.safeParse({ outcomes: [] }).success).toBe(false);
    expect(accepts({ patternId: 'fa-video' })).toBe(false);
    expect(accepts({ phase: 'samling' })).toBe(false);
    expect(learningDesignSchema.safeParse({ ...update, patternId: 'fa-video' }).success).toBe(true);
  });

  it.each([
    [' syk 110 ', 'SYK110'],
    ['ped-3001', 'PED-3001'],
    ['æøå1', 'ÆØÅ1'],
    // WHY: a decomposed «å» (a + combining ring) becomes the one letter Å only after NFC.
    ['såk1', 'SÅK1'],
  ])('[PED-030] the course code %j is normalised to %j', (input, expected) => {
    expect(courseCodeSchema.safeParse(input)).toEqual({ success: true, data: expected });
  });

  it('[PED-030] a course code that is too short, too long or has other characters is refused', () => {
    for (const code of ['S', '-SYK110', 'SYK110!', 'SYK_110', 'X'.repeat(21), '']) {
      expect(courseCodeSchema.safeParse(code).success, code).toBe(false);
    }
  });
});

describe('[PED-031] the alignment planner', () => {
  it('[PED-031] rows hold one cell per phase, gaps say what is missing, and untagged activities say why', () => {
    // Arrange
    const activity = { contentId: '0192f0c4-0000-7000-8000-000000000001', title: 'Quiz', status: 'draft' };
    const cells = ['forarbeid', 'underveis', 'etterarbeid'].map((phase, i) => ({
      phase,
      activities: i === 0 ? [activity] : [],
    }));
    const planner = {
      courseCode: 'SYK110',
      phases: ['forarbeid', 'underveis', 'etterarbeid'],
      rows: [{ outcome, cells }],
      gaps: [
        { kind: 'no-etterarbeid', outcome },
        { kind: 'empty-phase', phase: 'underveis' },
      ],
      untagged: [{ ...activity, missing: ['outcomes'] }],
    };
    // Act and assert
    expect(plannerSchema.safeParse(planner).success).toBe(true);
    expect(plannerSchema.safeParse({ ...planner, rows: [{ outcome, cells: cells.slice(1) }] }).success).toBe(
      false,
    );
    expect(plannerSchema.safeParse({ ...planner, gaps: [{ kind: 'empty-phase', outcome }] }).success).toBe(
      false,
    );
    expect(plannerSchema.safeParse({ ...planner, untagged: [{ ...activity, missing: [] }] }).success).toBe(
      false,
    );
    const twice = ['forarbeid', 'forarbeid', 'etterarbeid'];
    expect(plannerSchema.safeParse({ ...planner, phases: twice }).success).toBe(false);
  });
});

describe('[PED-032] what learners see', () => {
  it('[PED-032] a summary carries minutes and purpose, never the rationale, course code or outcomes', () => {
    // Arrange
    const summary = {
      id: '0192f0c4-0000-7000-8000-000000000001',
      title: 'Quiz',
      mainLibrary: 'H5P.MultiChoice',
      status: 'published',
      visibility: 'organisation',
      updatedAt: at,
      publishedAt: at,
      role: 'owner',
      language: 'nn',
    };
    const learnerFacing = { estimatedStudentMinutes: 10, learnerPurpose: 'Du øver på omgrepa.' };
    // Act and assert
    expect(contentSummarySchema.safeParse({ ...summary, ...learnerFacing }).success).toBe(true);
    for (const authorOnly of [{ rationale: 'Fordi.' }, { courseCode: 'SYK110' }, { outcomes: [outcome] }]) {
      expect(contentSummarySchema.safeParse({ ...summary, ...authorOnly }).success).toBe(false);
    }
    expect(learnerInfoSchema.safeParse({ ...learnerFacing, language: 'nn' }).success).toBe(true);
    expect(learnerInfoSchema.safeParse({ ...learnerFacing, rationale: 'Fordi.' }).success).toBe(false);
  });
});

describe('[PROD-001] creating from a pattern', () => {
  it('[PROD-001] the request names the language and may choose a phase, a course and one of the ten types', () => {
    // Act and assert
    expect(patternActivityRequestSchema.safeParse({ language: 'nn' }).success).toBe(true);
    const full = { language: 'en', phase: 'etterarbeid', courseCode: 'syk110', contentType: 'H5P.Blanks' };
    expect(patternActivityRequestSchema.parse(full).courseCode).toBe('SYK110');
    expect(patternActivityRequestSchema.safeParse({}).success).toBe(false);
    expect(patternActivityRequestSchema.safeParse({ language: 'se' }).success).toBe(false);
    expect(
      patternActivityRequestSchema.safeParse({ language: 'nn', contentType: 'H5P.DragQuestion' }).success,
    ).toBe(false);
    expect(patternActivityRequestSchema.safeParse({ language: 'nn', patternId: 'fa-video' }).success).toBe(
      false,
    );
  });
});
