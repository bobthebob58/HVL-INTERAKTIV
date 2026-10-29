/**
 * authorCourses — the course codes an author already works with, and the learning outcomes they already use in one
 * course.
 *
 * Why: PED-030's course-code field suggests codes rather than asking for free text each time, and offers the
 *      outcomes already used in the course as checkboxes, so the planner's rows match (D-087). D-088 lets the author
 *      choose the planner's course from their own codes.
 * Spec: PED-030, PED-031
 * Invariants:
 *   - Only the author's own and co-authored activities count (./authorScope.ts), and only their placements give
 *     Canvas labels; nothing names a person or another author's course.
 *   - Every code returned is a valid course code after D-087's normalisation; a stored value that is not is left out.
 *   - Each list is sorted in Norwegian order without repeats; outcomes are distinct by D-087's identity, ordered by
 *     category and then text (./outcomeIdentity.ts).
 * Collaborators: ./LearningDesignStore.ts, ./authorScope.ts, ./outcomeIdentity.ts, ./learningDesignRecord.ts,
 *   ../../lti/placements/courseLabel.ts (writes the labels), @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/metadata/courseCodeRoutes.int.test.ts
 */
import {
  courseCodeSchema,
  type CourseCode,
  type CourseCodeSuggestions,
  type CourseOutcomes,
} from '@hvl-interaktiv/api-contract';
import type { Database } from '../../infra/prismaClient.js';
import { authoredBy } from './authorScope.js';
import { contractOutcome } from './learningDesignRecord.js';
import { compareNorwegian, distinctOutcomes } from './outcomeIdentity.js';

/**
 * The valid, distinct course codes of a list of stored values, sorted.
 * @param values - Stored course codes or labels; null and invalid ones are left out.
 * @returns The normalised codes in Norwegian order.
 */
export function courseCodeList(values: readonly (string | null)[]): CourseCode[] {
  const codes = values.flatMap((value) => {
    const parsed = courseCodeSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
  return [...new Set(codes)].sort(compareNorwegian);
}

/**
 * The author's course codes: those in their activities' metadata, and their placements' Canvas course labels.
 * @param db - The database.
 * @param userId - The author's `User.id`.
 * @returns Both lists.
 * @spec PED-030
 */
export async function courseCodeSuggestions(db: Database, userId: string): Promise<CourseCodeSuggestions> {
  const [metadata, placements] = await Promise.all([
    db.learningDesignMetadata.findMany({
      where: { courseCode: { not: null }, content: authoredBy(userId) },
      select: { courseCode: true },
      distinct: ['courseCode'],
    }),
    db.ltiPlacement.findMany({
      // PRIVACY: only labels stored as course codes reach this table (../../lti/placements/courseLabel.ts, D-087).
      where: { contextLabel: { not: null }, content: authoredBy(userId) },
      select: { contextLabel: true },
      distinct: ['contextLabel'],
    }),
  ]);
  return {
    inUse: courseCodeList(metadata.map((row) => row.courseCode)),
    fromCanvas: courseCodeList(placements.map((row) => row.contextLabel)),
  };
}

/**
 * The distinct outcomes the author's activities already use for one course code.
 * @param db - The database.
 * @param userId - The author's `User.id`.
 * @param courseCode - A normalised course code.
 * @returns The course code and its outcomes, by category and then text.
 * @spec PED-030
 */
export async function courseOutcomes(
  db: Database,
  userId: string,
  courseCode: CourseCode,
): Promise<CourseOutcomes> {
  const rows = await db.learningOutcome.findMany({
    where: { metadata: { courseCode, content: authoredBy(userId) } },
    select: { text: true, category: true },
  });
  return { courseCode, outcomes: distinctOutcomes(rows.map(contractOutcome)) };
}
