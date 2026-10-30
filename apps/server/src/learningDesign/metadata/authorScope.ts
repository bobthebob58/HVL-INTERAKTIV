/**
 * authorScope — the activities that count as an author's own for the planner, the course-code suggestions and the
 * outcomes already used in a course: those they own and those they co-author.
 *
 * Why: D-088 builds the planner from "the author's own and co-authored activities", and D-087 (2026-10-28
 *      amendment) suggests the course labels of "the author's own placements", which are the placements of those same
 *      activities. One filter keeps the three answers about the same activities as the start page's list
 *      (../../content/contentSummaries.ts).
 * Spec: PED-030, PED-031
 * Invariants:
 *   - Exactly the activities the account owns or co-authors with the `coauthor` role; never an activity the person
 *     only may view or edit as an admin, so an admin's planner holds their own activities only.
 * Collaborators: ./authorCourses.ts, ./plannerSource.ts.
 * Tests: apps/server/test/learningDesign/metadata/plannerRoutes.int.test.ts
 */
/**
 * A Prisma `where` for `H5PContent` matching an author's own and co-authored activities; written out here, so the
 * generated client's types stay out of the API documentation.
 */
export interface AuthoredByFilter {
  OR: [{ ownerUserId: string }, { collaborators: { some: { userId: string; role: 'coauthor' } } }];
}

/**
 * The Prisma filter of an author's own and co-authored activities.
 * @param userId - The author's `User.id`.
 * @returns A `where` for `H5PContent`.
 * @spec PED-031
 */
export const authoredBy = (userId: string): AuthoredByFilter => ({
  OR: [{ ownerUserId: userId }, { collaborators: { some: { userId, role: 'coauthor' } } }],
});
