/**
 * Unit tests for the alignment planner's grid: rows are distinct outcomes in order, columns the phases in content
 * order, cells hold the activities of their phase, and the two gap rules and the untagged list follow D-088.
 *
 * Spec: PED-031
 */
import type { LearningOutcome, PhaseKey } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import {
  buildPlanner,
  type PlannerSourceActivity,
} from '../../../src/learningDesign/metadata/plannerGrid.js';

const PHASES: readonly PhaseKey[] = ['forarbeid', 'underveis', 'etterarbeid'];
const K1: LearningOutcome = { text: 'Forklare blodtrykk', category: 'kunnskap' };
const F1: LearningOutcome = { text: 'Måle puls', category: 'ferdigheiter' };
const G1: LearningOutcome = { text: 'Reflektere', category: 'generell-kompetanse' };

let next = 0;
const activity = (
  title: string,
  phase?: PhaseKey,
  outcomes: LearningOutcome[] = [],
): PlannerSourceActivity => {
  next += 1;
  return {
    contentId: `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`,
    title,
    status: 'draft',
    ...(phase ? { phase } : {}),
    outcomes,
  };
};
const titles = (cell: { activities: readonly { title: string }[] }) => cell.activities.map((a) => a.title);

describe('[PED-031] the planner grid', () => {
  it('[PED-031] rows are distinct outcomes by category, an activity appears in each of its rows, columns follow the phases', () => {
    // Arrange: «forklare  BLODTRYKK» is K1 typed again
    const activities = [
      activity('Øving', 'etterarbeid', [{ ...K1, text: 'forklare  BLODTRYKK' }]),
      activity('Alfa', 'forarbeid', [G1, K1, F1]),
      activity('Beta', 'forarbeid', [K1]),
    ];
    // Act
    const planner = buildPlanner('SYK110', PHASES, activities);
    // Assert
    expect(planner.phases).toEqual(PHASES);
    expect(planner.rows.map((row) => row.outcome.category)).toEqual([
      'kunnskap',
      'ferdigheiter',
      'generell-kompetanse',
    ]);
    const [k, f, g] = planner.rows;
    expect(k?.cells.map((cell) => [cell.phase, titles(cell)])).toEqual([
      ['forarbeid', ['Alfa', 'Beta']],
      ['underveis', []],
      ['etterarbeid', ['Øving']],
    ]);
    expect(f?.cells.map(titles)).toEqual([['Alfa'], [], []]);
    expect(g?.cells.map(titles)).toEqual([['Alfa'], [], []]);
  });

  it('[PED-031] gaps: each outcome without etterarbeid in row order, then each phase without any activity', () => {
    // Arrange
    const activities = [activity('Alfa', 'forarbeid', [K1, F1]), activity('Beta', 'etterarbeid', [K1])];
    // Act
    const { gaps } = buildPlanner('SYK110', PHASES, activities);
    // Assert
    expect(gaps).toEqual([
      { kind: 'no-etterarbeid', outcome: F1 },
      { kind: 'empty-phase', phase: 'underveis' },
    ]);
  });

  it('[PED-031] lists activities without a phase or outcomes below the table, saying which is missing', () => {
    // Arrange
    const activities = [
      activity('Zeta'),
      activity('Delta', undefined, [F1]),
      activity('Epsilon', 'underveis'),
      activity('Alfa', 'forarbeid', [K1]),
    ];
    // Act
    const planner = buildPlanner('SYK110', PHASES, activities);
    // Assert
    expect(planner.untagged.map((u) => [u.title, u.missing])).toEqual([
      ['Delta', ['phase']],
      ['Epsilon', ['outcomes']],
      ['Zeta', ['phase', 'outcomes']],
    ]);
    // WHY: an outcome of an activity without a phase is still a row, so it is never hidden (D-088).
    expect(planner.rows.map((row) => row.outcome)).toEqual([K1, F1]);
    expect(planner.rows[1]?.cells.every((cell) => cell.activities.length === 0)).toBe(true);
    expect(planner.gaps).toContainEqual({ kind: 'no-etterarbeid', outcome: F1 });
    // WHY: Epsilon has the phase underveis, so that phase is not empty, though it serves no outcome.
    expect(planner.gaps.filter((gap) => gap.kind === 'empty-phase')).toEqual([
      { kind: 'empty-phase', phase: 'etterarbeid' },
    ]);
  });

  it('[PED-031] a course without activities has no rows and every phase is a gap', () => {
    expect(buildPlanner('SYK110', PHASES, [])).toEqual({
      courseCode: 'SYK110',
      phases: PHASES,
      rows: [],
      gaps: PHASES.map((phase) => ({ kind: 'empty-phase', phase })),
      untagged: [],
    });
  });

  it('[PED-031] a cell names each activity with its status and language, and nothing else', () => {
    // Arrange
    const published = {
      ...activity('Quiz', 'forarbeid', [K1]),
      status: 'published' as const,
      language: 'en',
    };
    // Act
    const [row] = buildPlanner('SYK110', PHASES, [published]).rows;
    // Assert
    expect(row?.cells[0]?.activities).toEqual([
      { contentId: published.contentId, title: 'Quiz', status: 'published', language: 'en' },
    ]);
  });
});
