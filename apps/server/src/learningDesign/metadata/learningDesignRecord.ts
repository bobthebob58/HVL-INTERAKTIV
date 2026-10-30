/**
 * learningDesignRecord — converts between the stored learning-design rows (`LearningDesignMetadata` with its
 * `LearningOutcome`s) and the API contract's `LearningDesign`.
 *
 * Why: the database names the NKR category `generell_kompetanse` (an enum value cannot hold a hyphen) while the
 *      contract says `generell-kompetanse`, and a stored null is a left-out field in the contract (PED-030, D-087).
 *      One mapping keeps the GET, the PUT's answer, the course outcomes and the planner alike.
 * Spec: PED-030
 * Invariants:
 *   - A null column is left out of the answer, never sent as `null` or `""`; `updatedAt` is null without a row.
 *   - Outcomes keep their stored `position` order.
 *   - `patternId` is read here and never written: only creation and duplication write it (D-087).
 * Collaborators: ./LearningDesignStore.ts, ./authorCourses.ts, ./plannerSource.ts,
 *   apps/server/prisma/schema/learningDesign.prisma.
 * Tests: apps/server/test/learningDesign/metadata/learningDesignRoutes.int.test.ts
 */
import type {
  LearningDesign,
  LearningOutcome,
  OutcomeCategory,
  PhaseKey,
} from '@hvl-interaktiv/api-contract';

/** The database's NKR category (the `OutcomeCategory` enum of prisma/schema/learningDesign.prisma). */
export type StoredCategory = 'kunnskap' | 'ferdigheiter' | 'generell_kompetanse';

/** The stored metadata row with its outcomes, as `read` selects it. */
export interface StoredLearningDesign {
  /** The database's `Phase` enum has the contract's phase keys. */
  readonly phase: PhaseKey | null;
  readonly courseCode: string | null;
  readonly rationale: string | null;
  readonly estimatedStudentMinutes: number | null;
  readonly patternId: string | null;
  readonly learnerPurpose: string | null;
  readonly updatedAt: Date;
  readonly outcomes: readonly StoredOutcome[];
}

/** One stored outcome. */
export interface StoredOutcome {
  readonly text: string;
  readonly category: StoredCategory;
}

/** The Prisma `select` that reads a `StoredLearningDesign`. */
export const STORED_LEARNING_DESIGN = {
  phase: true,
  courseCode: true,
  rationale: true,
  estimatedStudentMinutes: true,
  patternId: true,
  learnerPurpose: true,
  updatedAt: true,
  outcomes: { select: { text: true, category: true }, orderBy: { position: 'asc' } },
} as const;

/**
 * The stored form of an NKR category.
 * @param category - The contract's category.
 * @returns The database enum value.
 */
export const storedCategory = (category: OutcomeCategory): StoredCategory =>
  category === 'generell-kompetanse' ? 'generell_kompetanse' : category;

/**
 * The contract's form of a stored NKR category.
 * @param category - The database enum value.
 * @returns The contract's category.
 */
export const contractCategory = (category: StoredCategory): OutcomeCategory =>
  category === 'generell_kompetanse' ? 'generell-kompetanse' : category;

/**
 * A stored outcome in the contract's shape.
 * @param outcome - The stored text and category.
 * @returns The outcome.
 */
export const contractOutcome = (outcome: StoredOutcome): LearningOutcome => ({
  text: outcome.text,
  category: contractCategory(outcome.category),
});

const present = <K extends string, V>(key: K, value: V | null): Partial<Record<K, V>> =>
  value === null ? {} : ({ [key]: value } as Record<K, V>);

/**
 * The contract's metadata for a stored row, or the empty metadata when there is none.
 * @param row - The stored row, or null.
 * @returns The `LearningDesign` answer.
 * @spec PED-030
 */
export function toLearningDesign(row: StoredLearningDesign | null): LearningDesign {
  if (!row) return { outcomes: [], updatedAt: null };
  return {
    ...present('phase', row.phase),
    ...present('courseCode', row.courseCode),
    outcomes: row.outcomes.map(contractOutcome),
    ...present('rationale', row.rationale),
    ...present('estimatedStudentMinutes', row.estimatedStudentMinutes),
    ...present('learnerPurpose', row.learnerPurpose),
    ...present('patternId', row.patternId),
    updatedAt: row.updatedAt.toISOString(),
  };
}
