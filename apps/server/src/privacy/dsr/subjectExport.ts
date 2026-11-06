/**
 * subjectExport — the machine-readable export of everything stored about a data subject under their keys and
 * matched learner accounts (the right of access).
 *
 * Why: DATA-008 exports a learner's data as JSON; D-108 gives the stored fields, contexts as D-103's strings, and its
 *      amendment of 2026-11-04 settles the rest: the encrypted `sub` is left out (its plaintext is the `sub` the
 *      request gave), and the learner accounts' authentication events (D-064) are listed too.
 * Spec: DATA-008, DATA-012, DATA-002
 * Invariants:
 *   - Every stored field of the covered rows, except `GradeSyncJob.ltiSubEncrypted`, whose bytes are never read here;
 *     `ltiSubStored` says whether one is held.
 *   - Rows in a stable order (by time, then ID), so two exports of unchanged data are equal.
 *   - Read only.
 *   - PRIVACY: the document holds the person's own data and goes to them through HVL's DPO; nothing here logs it
 *     (DATA-009). It never holds the Feide ID or `sub` the request gave.
 * Collaborators: ./subjectRows.ts, ./subjectKeys.ts, ../../xapi/platformContextKey.ts, ./dataSubjectRequest.ts.
 * Tests: apps/server/test/privacy/dsr/dataSubjectRequest.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import { platformContextKey } from '../../xapi/platformContextKey.js';
import type { SubjectKeys, SubjectPseudonym } from './subjectKeys.js';
import { byLearnerKeys, type SubjectAccounts } from './subjectRows.js';

/** The format name and version of the export document. */
export const SUBJECT_EXPORT_FORMAT = 'hvl-interaktiv/data-subject-export/1';

/** The request an export answers. */
export interface ExportRequest {
  /** The random request ID, as audited. */
  readonly requestId: string;
  /** When the export was made. */
  readonly at: Date;
}

/** The export document (serialised with `JSON.stringify`; dates become ISO 8601 strings). */
export interface SubjectExport {
  readonly format: typeof SUBJECT_EXPORT_FORMAT;
  readonly request: {
    readonly id: string;
    readonly at: Date;
    readonly academicYearsSearched: readonly number[];
  };
  readonly pseudonyms: readonly SubjectPseudonym[];
  readonly xapiStatements: readonly object[];
  readonly h5pUserData: readonly object[];
  readonly gradeSyncJobs: readonly object[];
  readonly identities: readonly object[];
  readonly accounts: readonly object[];
  readonly authEvents: readonly object[];
}

/** The course of a placement as D-103's string, or null when the stored parts cannot form one. */
function courseOf(platformId: string, contextId: string): string | null {
  try {
    return platformContextKey(platformId, contextId);
  } catch {
    return null;
  }
}

/** Reads the grade jobs without their encrypted `sub`, adding the course and whether a `sub` is held. */
async function gradeJobsOf(db: Database, keys: SubjectKeys): Promise<object[]> {
  const where = byLearnerKeys(keys);
  const [jobs, withSub] = await Promise.all([
    db.gradeSyncJob.findMany({
      where,
      // PRIVACY: the ciphertext is never selected; its plaintext is the `sub` the request gave (D-108 amendment).
      omit: { ltiSubEncrypted: true },
      include: { placement: { select: { platformId: true, contextId: true, contentId: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    db.gradeSyncJob.findMany({ where: { ...where, ltiSubEncrypted: { not: null } }, select: { id: true } }),
  ]);
  const held = new Set(withSub.map((row) => row.id));
  return jobs.map(({ placement, ...job }) => ({
    ...job,
    contentId: placement.contentId,
    course: courseOf(placement.platformId, placement.contextId),
    ltiSubStored: held.has(job.id),
  }));
}

/**
 * Builds the export of a data subject.
 * @param db - The database.
 * @param keys - The derived keys.
 * @param accounts - The matched learner accounts.
 * @param request - The request's ID and moment.
 * @returns The export document.
 * @spec DATA-008
 */
export async function exportSubject(
  db: Database,
  keys: SubjectKeys,
  accounts: SubjectAccounts,
  request: ExportRequest,
): Promise<SubjectExport> {
  const where = byLearnerKeys(keys);
  const userIds = [...accounts.learnerUserIds];
  const [xapiStatements, h5pUserData, gradeSyncJobs, identities, users, authEvents] = await Promise.all([
    db.xapiStatement.findMany({ where, orderBy: [{ timestamp: 'asc' }, { id: 'asc' }] }),
    db.h5PUserData.findMany({ where, orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }] }),
    gradeJobsOf(db, keys),
    db.identity.findMany({
      where: { id: { in: [...accounts.learnerIdentityIds] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    // PRIVACY: learner accounts hold no name or e-mail (a CHECK constraint, DATA-002), so none is selected.
    db.user.findMany({
      where: { id: { in: userIds }, kind: 'learner' },
      select: { id: true, kind: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    db.authAuditEvent.findMany({
      where: { actorUserId: { in: userIds } },
      orderBy: [{ at: 'asc' }, { id: 'asc' }],
    }),
  ]);
  return {
    format: SUBJECT_EXPORT_FORMAT,
    request: { id: request.requestId, at: request.at, academicYearsSearched: [...keys.years] },
    pseudonyms: [...keys.pseudonyms],
    xapiStatements,
    h5pUserData,
    gradeSyncJobs,
    identities,
    accounts: users,
    authEvents,
  };
}

/**
 * The number of rows of each kind an export holds (for the audit and the summary: counts only).
 * @param document - The export.
 * @returns Rows per section.
 */
export const exportCounts = (document: SubjectExport): Record<string, number> => ({
  xapiStatements: document.xapiStatements.length,
  h5pUserData: document.h5pUserData.length,
  gradeSyncJobs: document.gradeSyncJobs.length,
  learnerIdentities: document.identities.length,
  learnerUsers: document.accounts.length,
  authEvents: document.authEvents.length,
});
