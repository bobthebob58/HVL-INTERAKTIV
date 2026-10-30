/**
 * contentSummaries — reads the activities a person owns or co-authors, and one activity's summary, in the shape of
 * the API contract.
 *
 * Why: the web app's start page lists an author's activities (PROD-003 needs their status at a glance), and the
 *      activity page shows one. Only the fields the contract names are read, so no name, e-mail address or other
 *      person's ID leaves the server (DATA-002). The activity's own language goes with its title, so the web app can
 *      mark the title with `lang` (WCAG 3.1.2, UD-010). Learners see the estimated minutes and the purpose before
 *      they start (PED-032), so a summary carries those two fields of the learning design (D-087).
 * Spec: PROD-003, PROD-006, DATA-002, UD-010, PED-032
 * Invariants:
 *   - The list holds exactly the activities the account owns or co-authors with the `coauthor` role, newest change
 *     first (ties broken by ID, so the order is stable).
 *   - Dates are ISO strings in UTC; `publishedAt` is null while it was never published through the flow.
 *   - PRIVACY: of the stored metadata only the language tag leaves the server (`activityLanguage`), never its
 *     authors or other fields; `language` is absent when the activity states none.
 *   - PRIVACY and pedagogy: of the learning design only the minutes and the purpose are read, never the rationale,
 *     the course code or the outcomes (D-087); the detail is read only after the View check (its route's job).
 * Collaborators: ../http/api/contentListRoutes.ts, ./contentAccess.ts, ../validation/activityLanguage.ts,
 *   ../learningDesign/metadata/learnerInfoFields.ts.
 * Tests: apps/server/test/http/api/contentListRoutes.int.test.ts,
 *   apps/server/test/learningDesign/metadata/learnerInfo.int.test.ts
 */
import type { ContentSummary } from '@hvl-interaktiv/api-contract';
import type { Database } from '../infra/prismaClient.js';
import {
  LEARNER_INFO_SELECT,
  learnerInfoFields,
  type StoredLearnerInfo,
} from '../learningDesign/metadata/learnerInfoFields.js';
import { activityLanguage } from '../validation/activityLanguage.js';

const SUMMARY_FIELDS = {
  id: true,
  title: true,
  mainLibrary: true,
  status: true,
  visibility: true,
  updatedAt: true,
  publishedAt: true,
  ownerUserId: true,
  metadata: true,
  learningDesign: { select: LEARNER_INFO_SELECT },
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
  /** The stored h5p.json-style metadata; only its language is used. */
  readonly metadata: unknown;
  /** The learner-facing learning-design fields (PED-032), or null without metadata. */
  readonly learningDesign: StoredLearnerInfo | null;
}

/**
 * The summary of one activity without the person's role.
 * @param row - The stored fields.
 * @returns Every summary field except `role`.
 */
export const summaryFields = (row: SummaryRow): Omit<ContentSummary, 'role'> => {
  const language = activityLanguage(row.metadata);
  return {
    id: row.id,
    title: row.title,
    mainLibrary: row.mainLibrary,
    status: row.status,
    visibility: row.visibility,
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    ...(language ? { language } : {}),
    ...learnerInfoFields(row.learningDesign),
  };
};

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
