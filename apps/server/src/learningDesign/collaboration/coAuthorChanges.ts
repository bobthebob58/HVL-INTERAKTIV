/**
 * coAuthorChanges — reads an activity's owner and co-authors, and adds or removes one co-author with its audit event,
 * in one transaction each.
 *
 * Why: PROD-007 lets authors work on an activity together; D-090 caps an activity at 20 co-authors and audits every
 *      change with user IDs only. The permission rules decide who may ask (./coAuthorRequests.ts); this module keeps
 *      the stored list and its audit trail exact, also when two requests arrive at once.
 * Spec: PROD-007, DATA-007, H5P-006
 * Invariants:
 *   - Adding locks the activity's row (`FOR UPDATE`) before it counts, so two concurrent adds can never pass 20.
 *   - Adding an existing co-author and removing someone who is not one change nothing and write no audit event.
 *   - Only the `coauthor` role is read or written (the permission facts count no other role).
 *   - PRIVACY: an audit event names the actor in its column and the co-author's user ID in its details, never a name
 *     (DATA-007). The list carries user IDs and display names only (D-090).
 *   - A change takes effect at the next request: every permission check reads the co-authors again
 *     (../../h5p/permissions/ContentAccessRepository.ts has no cache).
 * Collaborators: ./coAuthorRequests.ts (the caller), ./PeopleDirectory.ts (`personOf`), ../../infra/prismaClient.ts,
 *   ../../http/learningDesignErrors.ts.
 * Tests: apps/server/test/learningDesign/collaboration/coAuthorRoutes.int.test.ts
 */
import { MAX_COAUTHORS, type CoAuthorList } from '@hvl-interaktiv/api-contract';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import type { Database } from '../../infra/prismaClient.js';
import { personOf } from './PeopleDirectory.js';

/** The audit action of an added co-author. */
export const COAUTHOR_ADDED_ACTION = 'content.coauthor.add';
/** The audit action of a removed co-author. */
export const COAUTHOR_REMOVED_ACTION = 'content.coauthor.remove';

/** One change of an activity's co-authors. */
export interface CoAuthorChange {
  /** The canonical activity ID. */
  readonly contentId: string;
  /** Who asks (the owner, or a co-author removing themself). */
  readonly actorUserId: string;
  /** The co-author added or removed. */
  readonly userId: string;
}

const auditData = (change: CoAuthorChange, action: string) => ({
  actorUserId: change.actorUserId,
  action,
  targetType: 'H5PContent',
  targetId: change.contentId,
  // PRIVACY: a user ID only (DATA-007); the co-author's name is read from their account when shown.
  details: { userId: change.userId },
});

/**
 * Reads the owner and co-authors of an activity, as the contract shows them.
 * @param db - The database.
 * @param contentId - The canonical activity ID.
 * @param viewerUserId - Who reads the list: their entry gets `isSelf`; as the owner they get `mayManage`.
 * @returns The list, co-authors by the time they were added; null when the activity no longer exists.
 * @spec PROD-007
 */
export async function readCoAuthorList(
  db: Database,
  contentId: string,
  viewerUserId: string,
): Promise<CoAuthorList | null> {
  const row = await db.h5PContent.findUnique({
    where: { id: contentId },
    select: {
      owner: { select: { id: true, displayName: true } },
      collaborators: {
        where: { role: 'coauthor' },
        orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
        select: { user: { select: { id: true, displayName: true } } },
      },
    },
  });
  if (!row) return null;
  return {
    owner: personOf(row.owner),
    coAuthors: row.collaborators.map(({ user }) => ({ ...personOf(user), isSelf: user.id === viewerUserId })),
    mayManage: row.owner.id === viewerUserId,
  };
}

/**
 * Adds a co-author unless they already are one, and audits it.
 * @param db - The database.
 * @param change - The activity, the owner and the person to add (already checked as findable).
 * @returns True when added, false when they already were a co-author.
 * @throws HttpError 409 `hvl:coauthor-limit` when the activity already has 20 co-authors.
 * @spec PROD-007
 */
export async function addCoAuthor(db: Database, change: CoAuthorChange): Promise<boolean> {
  const { contentId, userId } = change;
  return db.$transaction(async (tx) => {
    // WHY: the row lock serialises concurrent adds to one activity, so the count below stays true until commit.
    await tx.$queryRaw`SELECT 1 FROM "H5PContent" WHERE "id" = ${contentId}::uuid FOR UPDATE`;
    const existing = await tx.contentCollaborator.findUnique({
      where: { contentId_userId: { contentId, userId } },
      select: { role: true },
    });
    if (existing) return false;
    const count = await tx.contentCollaborator.count({ where: { contentId, role: 'coauthor' } });
    if (count >= MAX_COAUTHORS) throw learningDesignError('hvl:coauthor-limit');
    await tx.contentCollaborator.create({ data: { contentId, userId, role: 'coauthor' } });
    await tx.auditEvent.create({ data: auditData(change, COAUTHOR_ADDED_ACTION) });
    return true;
  });
}

/**
 * Removes a co-author, if they are one, and audits it.
 * @param db - The database.
 * @param change - The activity, who asks and the co-author to remove.
 * @returns True when removed, false when they were not a co-author.
 * @spec PROD-007
 */
export async function removeCoAuthor(db: Database, change: CoAuthorChange): Promise<boolean> {
  const { contentId, userId } = change;
  return db.$transaction(async (tx) => {
    const { count } = await tx.contentCollaborator.deleteMany({
      where: { contentId, userId, role: 'coauthor' },
    });
    if (count === 0) return false;
    await tx.auditEvent.create({ data: auditData(change, COAUTHOR_REMOVED_ACTION) });
    return true;
  });
}
