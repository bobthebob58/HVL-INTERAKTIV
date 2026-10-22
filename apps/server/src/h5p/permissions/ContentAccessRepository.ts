/**
 * ContentAccessRepository — reads the facts the permission system needs about one activity.
 *
 * Why: the permission rules are pure functions; this is the one place that asks the database who owns an
 *      activity, who co-authors it, whether it is published and who may see it (H5P-006, PROD-006).
 * Spec: H5P-006, PROD-004, PROD-006
 * Invariants:
 *   - One query per lookup: owner, status, visibility and co-authors come from a single `findUnique`.
 *   - A content ID that is not a UUID is unknown (`undefined`) and never reaches the database.
 *   - Only co-authors with the `coauthor` role count; a future role grants nothing until the rules know it.
 *   - Facts carry account IDs and flags only, never names or e-mail addresses.
 * Collaborators: ../HvlPermissionSystem.ts (the caller), ./contentRules.ts (reads the facts),
 *   ../../infra/prismaClient.ts.
 * Tests: apps/server/test/h5p/permissions/ContentAccessRepository.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';

/** Whether learners may see an activity at all (`PROD-004`). */
export type ContentStatus = 'draft' | 'published';

/** Who may open an activity outside Canvas (`PROD-006`): only me and co-authors, all of HVL, any Feide user. */
export type ContentVisibility = 'private' | 'organisation' | 'feide';

/** What the permission rules know about one activity. */
export interface ContentFacts {
  /** The activity's ID as stored (canonical lower-case UUID); matched against LTI launch IDs. */
  readonly contentId: string;
  /** `User.id` of the owner. */
  readonly ownerUserId: string;
  /** `User.id` of every co-author. */
  readonly coAuthorIds: readonly string[];
  /** Draft or published. */
  readonly status: ContentStatus;
  /** Who may see the activity when it is published. */
  readonly visibility: ContentVisibility;
}

/** Looks up the facts about an activity for a permission check. */
export interface ContentAccessRepository {
  /**
   * Reads the facts about one activity.
   * @param contentId - The ID Lumi asks about (untrusted: it comes from the request).
   * @returns The facts, or `undefined` when no such activity exists.
   */
  factsFor(contentId: string): Promise<ContentFacts | undefined>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `ContentAccessRepository` on PostgreSQL (`H5PContent` and `ContentCollaborator`). */
export class PrismaContentAccessRepository implements ContentAccessRepository {
  /**
   * @param db - The server's Prisma client; the caller owns and disconnects it.
   */
  constructor(private readonly db: Database) {}

  /**
   * Reads owner, co-authors, status and visibility of one activity in one query.
   * @param contentId - The ID Lumi asks about.
   * @returns The facts, or `undefined` for an unknown or malformed ID.
   */
  async factsFor(contentId: string): Promise<ContentFacts | undefined> {
    // SECURITY: a malformed ID would make PostgreSQL raise an error; unknown is the fail-closed answer.
    if (typeof contentId !== 'string' || !UUID.test(contentId)) return undefined;
    const row = await this.db.h5PContent.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
        visibility: true,
        collaborators: { where: { role: 'coauthor' }, select: { userId: true } },
      },
    });
    if (!row) return undefined;
    return Object.freeze({
      contentId: row.id,
      ownerUserId: row.ownerUserId,
      coAuthorIds: Object.freeze(row.collaborators.map((c) => c.userId)),
      status: row.status,
      visibility: row.visibility,
    });
  }
}
