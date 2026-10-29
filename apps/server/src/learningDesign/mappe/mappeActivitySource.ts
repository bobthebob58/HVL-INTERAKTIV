/**
 * mappeActivitySource — reads, for the pedagogisk mappe, the author's own and co-authored activities: the picker's
 * list, and the selected activities with everything the export shows about them.
 *
 * Why: MAPPE-001 lets an author pick from their own work, and D-094 shows each picked activity's title, type, phase,
 *      course, outcomes, rationale, validator result with acknowledgements, link and dates. The rows are read once
 *      per request here, so the renderer stays pure and testable without a database.
 * Spec: MAPPE-001, MAPPE-002, MAPPE-003
 * Invariants:
 *   - Only activities the account owns or co-authors (../metadata/authorScope.ts `authoredBy`); a stranger's activity
 *     is never read, and a request naming one is refused as unavailable, like an unknown one (D-066).
 *   - Only reads: no row is created, changed or deleted (MAPPE-003: the export is not stored).
 *   - PRIVACY: of an acknowledgement only the rule, path, reason and date are read, never who gave it; of the
 *     collaborators only whether there are any; nothing about learners is read here.
 *   - The rationale is read only for the author, who may edit the activity (D-087).
 * Collaborators: ./MappeRenderer.ts, ../metadata/authorScope.ts, ../metadata/learningDesignRecord.ts,
 *   ../../validation/activityLanguage.ts, ../../http/authErrors.ts.
 * Tests: apps/server/test/learningDesign/mappe/mappeExport.int.test.ts,
 *   apps/server/test/learningDesign/mappe/mappeRoutes.int.test.ts
 */
import type { LearningOutcome, MappeActivity, PhaseKey } from '@hvl-interaktiv/api-contract';
import type { StoredAcknowledgement } from '../../content/acknowledgementCoverage.js';
import type { StoredContentRow } from '../../content/storedContent.js';
import { authError } from '../../http/authErrors.js';
import type { Database } from '../../infra/prismaClient.js';
import { activityLanguage } from '../../validation/activityLanguage.js';
import { authoredBy } from '../metadata/authorScope.js';
import { contractOutcome, type StoredCategory } from '../metadata/learningDesignRecord.js';

/** One selected activity as the export reads it. */
export interface MappeSourceActivity extends StoredContentRow {
  readonly title: string;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
  readonly phase?: PhaseKey;
  readonly courseCode?: string;
  readonly rationale?: string;
  readonly patternId?: string;
  readonly outcomes: readonly LearningOutcome[];
  /** True when the author co-authors it, or it has co-authors (D-094: the collaboration count). */
  readonly collaborative: boolean;
  /** Its acknowledgements of every age, newest first. */
  readonly acknowledgements: readonly StoredAcknowledgement[];
}

/**
 * The activities an author can pick, newest change first.
 * @param db - The database.
 * @param userId - The author's `User.id`.
 * @returns The picker's items: own and co-authored activities only.
 * @spec MAPPE-001
 */
export async function mappeActivityItems(db: Database, userId: string): Promise<MappeActivity[]> {
  const rows = await db.h5PContent.findMany({
    where: authoredBy(userId),
    select: {
      id: true,
      title: true,
      mainLibrary: true,
      status: true,
      metadata: true,
      updatedAt: true,
      learningDesign: { select: { phase: true, courseCode: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
  return rows.map((row) => {
    const language = activityLanguage(row.metadata);
    const { phase, courseCode } = row.learningDesign ?? {};
    return {
      contentId: row.id,
      title: row.title,
      mainLibrary: row.mainLibrary,
      status: row.status,
      ...(language ? { language } : {}),
      ...(phase ? { phase } : {}),
      ...(courseCode ? { courseCode } : {}),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

const optional = <K extends string, V>(key: K, value: V | null | undefined): Partial<Record<K, V>> =>
  value === null || value === undefined ? {} : ({ [key]: value } as Record<K, V>);

/**
 * The selected activities with what the export shows, in the order requested.
 * @param db - The database.
 * @param userId - The author's `User.id`.
 * @param contentIds - The selected activities (distinct UUIDs, already checked by the contract's schema).
 * @returns One entry per ID.
 * @throws HttpError 404 `hvl:activity-unavailable` when any ID is not an activity the author owns or co-authors.
 * @spec MAPPE-001
 */
export async function mappeSourceActivities(
  db: Database,
  userId: string,
  contentIds: readonly string[],
): Promise<MappeSourceActivity[]> {
  const rows = await db.h5PContent.findMany({
    where: { AND: [authoredBy(userId), { id: { in: [...contentIds] } }] },
    select: {
      id: true,
      title: true,
      mainLibrary: true,
      params: true,
      metadata: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      ownerUserId: true,
      _count: { select: { collaborators: { where: { role: 'coauthor' } } } },
      learningDesign: {
        select: {
          phase: true,
          courseCode: true,
          rationale: true,
          patternId: true,
          outcomes: { select: { text: true, category: true }, orderBy: { position: 'asc' } },
        },
      },
      acknowledgements: {
        select: { ruleId: true, path: true, reason: true, at: true },
        orderBy: { at: 'desc' },
      },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return contentIds.map((contentId) => {
    const row = byId.get(contentId);
    // SECURITY: an unknown activity and someone else's answer alike, so the export reveals nothing (D-066).
    if (!row) throw authError('hvl:activity-unavailable');
    const design = row.learningDesign;
    return {
      id: row.id,
      title: row.title,
      mainLibrary: row.mainLibrary,
      params: row.params,
      metadata: row.metadata,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
      ...optional('phase', design?.phase),
      ...optional('courseCode', design?.courseCode),
      ...optional('rationale', design?.rationale),
      ...optional('patternId', design?.patternId),
      outcomes: (design?.outcomes ?? []).map((outcome) =>
        contractOutcome({ text: outcome.text, category: outcome.category as StoredCategory }),
      ),
      collaborative: row.ownerUserId !== userId || row._count.collaborators > 0,
      acknowledgements: row.acknowledgements,
    };
  });
}

/**
 * The author's name as the portfolio's byline gives it.
 * @param db - The database.
 * @param userId - The author's `User.id`.
 * @returns The stored display name, or undefined (an account without one, such as a Canvas-only account).
 * @spec MAPPE-001
 */
export async function mappeAuthorName(db: Database, userId: string): Promise<string | undefined> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  return user?.displayName?.trim() || undefined;
}
