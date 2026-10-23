/**
 * deepLinkActivities — what the Deep Linking picker offers an author, and the check of what they chose.
 *
 * Why: LTI-005 lets an author pick existing activities to place in Canvas; in S3 these are their own and
 *      co-authored activities (D-061). Drafts are listed so the author sees them, but cannot be returned to Canvas
 *      (LTI-005 acceptance, PROD-004).
 * Spec: LTI-005, PROD-005, PROD-004
 * Invariants:
 *   - Only activities the author owns or co-authors are listed or accepted; anything else is "not available" (404),
 *     whether it exists or not.
 *   - A chosen draft is refused with 409 `hvl:deep-link-draft`, before any JWT is signed.
 *   - The list is bounded and ordered by last change, newest first.
 * Collaborators: ./deepLinkRoutes.ts, ./deepLinkItems.ts, ../../http/authErrors.ts.
 * Tests: apps/server/test/lti/deepLinking/deepLinkActivities.int.test.ts
 */
import { authError } from '../../http/authErrors.js';
import type { Database } from '../../infra/prismaClient.js';

/** The most activities the picker lists. */
export const PICKER_LIMIT = 200;

/** One activity in the picker. */
export interface PickerActivity {
  /** `H5PContent.id`. */
  readonly id: string;
  /** Its title. */
  readonly title: string;
  /** Its main content type, e.g. `H5P.MultiChoice`. */
  readonly mainLibrary: string;
  /** Only published activities can be placed. */
  readonly selectable: boolean;
}

const ownOrCoAuthored = (userId: string) => ({
  OR: [{ ownerUserId: userId }, { collaborators: { some: { userId } } }],
});

/**
 * Lists the activities an author may place.
 * @param db - The database.
 * @param userId - The author's `User.id`.
 * @returns Own and co-authored activities, newest first; drafts marked not selectable.
 */
export async function listPickerActivities(db: Database, userId: string): Promise<PickerActivity[]> {
  const rows = await db.h5PContent.findMany({
    where: ownOrCoAuthored(userId),
    select: { id: true, title: true, mainLibrary: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: PICKER_LIMIT,
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    mainLibrary: row.mainLibrary,
    selectable: row.status === 'published',
  }));
}

/**
 * Checks what an author chose and returns the chosen activities in the order given.
 * @param db - The database.
 * @param userId - The author's `User.id`.
 * @param contentIds - The chosen activity IDs.
 * @returns ID and title of each.
 * @throws HttpError 404 `hvl:activity-unavailable` for an unknown or foreign ID, 409 `hvl:deep-link-draft` for a
 *   draft.
 */
export async function chosenActivities(
  db: Database,
  userId: string,
  contentIds: readonly string[],
): Promise<{ id: string; title: string }[]> {
  const unique = [...new Set(contentIds)];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (unique.length === 0 || !unique.every((id) => UUID.test(id)))
    throw authError('hvl:activity-unavailable');
  const rows = await db.h5PContent.findMany({
    where: { id: { in: unique }, ...ownOrCoAuthored(userId) },
    select: { id: true, title: true, status: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return unique.map((id) => {
    const row = byId.get(id);
    // SECURITY: an ID that exists but is someone else's gets the same answer as one that does not exist.
    if (!row) throw authError('hvl:activity-unavailable');
    if (row.status !== 'published') throw authError('hvl:deep-link-draft');
    return { id: row.id, title: row.title };
  });
}
