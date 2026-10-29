/**
 * ContentAccessRepository — reads the facts the permission system needs about one activity.
 *
 * Why: the permission rules are pure functions; this is the one place that asks the database who owns an
 *      activity, who co-authors it, whether it is published, who may see it (H5P-006, PROD-006) and whether it is
 *      listed in the content bank (PROD-007, D-091), which decides who may duplicate it (D-092).
 * Spec: H5P-006, PROD-004, PROD-006, PROD-007
 * Invariants:
 *   - One query per lookup: owner, status, visibility, bank listing and co-authors come from a single `findUnique`.
 *   - A content ID that is not a UUID is unknown (`undefined`) and never reaches the database; a UUID is looked up in
 *     lower case, as PostgreSQL stores it, so look-ups Prisma batches find it in any spelling.
 *   - Only co-authors with the `coauthor` role count; a future role grants nothing until the rules know it.
 *   - Facts carry account IDs and flags only, never names or e-mail addresses.
 * Collaborators: ../HvlPermissionSystem.ts (the caller), ./contentRules.ts (reads the facts),
 *   ../../learningDesign/collaboration/duplicateRules.ts (reads `bankListed`), ../../infra/prismaClient.ts.
 * Tests: apps/server/test/h5p/permissions/HvlPermissionSystem.int.test.ts,
 *   apps/server/test/h5p/permissions/contentFactsBatching.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import { isContentUuid } from '../contentIds.js';

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
  /** Listed in the HVL content bank (`H5PContent.bankListedAt` is set, D-091): colleagues may duplicate it. */
  readonly bankListed: boolean;
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

/** `ContentAccessRepository` on PostgreSQL (`H5PContent` and `ContentCollaborator`). */
export class PrismaContentAccessRepository implements ContentAccessRepository {
  /**
   * @param db - The server's Prisma client; the caller owns and disconnects it.
   */
  constructor(private readonly db: Database) {}

  /**
   * Reads owner, co-authors, status, visibility and bank listing of one activity in one query.
   * @param contentId - The ID Lumi asks about.
   * @returns The facts, or `undefined` for an unknown or malformed ID.
   */
  async factsFor(contentId: string): Promise<ContentFacts | undefined> {
    // SECURITY: a malformed ID would make PostgreSQL raise an error; unknown is the fail-closed answer.
    if (!isContentUuid(contentId)) return undefined;
    // WHY: Prisma batches the `findUnique` calls of one tick into one `IN (…)` query and matches the rows back by
    // string equality; PostgreSQL finds an upper-case UUID, but its stored lower-case ID would then match no call.
    const row = await this.db.h5PContent.findUnique({
      where: { id: contentId.toLowerCase() },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
        visibility: true,
        bankListedAt: true,
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
      bankListed: row.bankListedAt !== null,
    });
  }
}
