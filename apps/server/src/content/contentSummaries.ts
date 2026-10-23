/**
 * contentSummaries — reads the activities a person owns or co-authors, and one activity's summary, in the shape of
 * the API contract.
 *
 * Why: the web app's start page lists an author's activities (PROD-003 needs their status at a glance), and the
 *      activity page shows one. Only the fields the contract names are read, so no name, e-mail address or other
 *      person's ID leaves the server (DATA-002).
 * Spec: PROD-003, PROD-006, DATA-002
 * Invariants:
 *   - The list holds exactly the activities the account owns or co-authors with the `coauthor` role, newest change
 *     first (ties broken by ID, so the order is stable).
 *   - Dates are ISO strings in UTC; `publishedAt` is null while it was never published through the flow.
 * Collaborators: ../http/api/contentListRoutes.ts, ./contentAccess.ts.
 * Tests: apps/server/test/http/api/contentListRoutes.int.test.ts
 */
import type { ContentSummary } from '@hvl-interaktiv/api-contract';
import type { Database } from '../infra/prismaClient.js';

const SUMMARY_FIELDS = {
  id: true,
  title: true,
  mainLibrary: true,
  status: true,
  visibility: true,
  updatedAt: true,
  publishedAt: true,
  ownerUserId: true,
} as const;

/** The stored fields a summary is made of. */
export interface SummaryRow {
  readonly id: string;
  readonly title: string;
  readonly mainLibrary: string;
  readonly status: ContentSummary['status'];
  readonly visibility: ContentSummary['visibility'];
  readonly updatedAt: Date;
  readonly publishedAt: Date | null;
  readonly ownerUserId: string;
}

/**
 * The summary of one activity without the person's role.
 * @param row - The stored fields.
 * @returns Every summary field except `role`.
 */
export const summaryFields = (row: SummaryRow): Omit<ContentSummary, 'role'> => ({
  id: row.id,
  title: row.title,
  mainLibrary: row.mainLibrary,
  status: row.status,
  visibility: row.visibility,
  updatedAt: row.updatedAt.toISOString(),
  publishedAt: row.publishedAt?.toISOString() ?? null,
});

/**
 * The activities an account owns or co-authors.
 * @param db - The database.
 * @param userId - The account.
 * @returns Their summaries, newest change first.
 */
export async function authoredContent(db: Database, userId: string): Promise<ContentSummary[]> {
  const rows = await db.h5PContent.findMany({
    where: {
      OR: [{ ownerUserId: userId }, { collaborators: { some: { userId, role: 'coauthor' } } }],
    },
    select: SUMMARY_FIELDS,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
  return rows.map((row) => ({
    ...summaryFields(row),
    role: row.ownerUserId === userId ? 'owner' : 'coAuthor',
  }));
}

/**
 * The stored summary fields of one activity.
 * @param db - The database.
 * @param contentId - The canonical activity ID.
 * @returns The fields, or null when it no longer exists.
 */
export const summaryRow = (db: Database, contentId: string): Promise<SummaryRow | null> =>
  db.h5PContent.findUnique({ where: { id: contentId }, select: SUMMARY_FIELDS });
