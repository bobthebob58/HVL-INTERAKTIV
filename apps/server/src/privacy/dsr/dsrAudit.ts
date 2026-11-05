/**
 * dsrAudit — the audit event of a data-subject request: the operator, the action and counts, under a random request ID
 * that is never an identifier of the person.
 *
 * Why: DATA-008 audits every use, and DATA-007 lists data-subject actions among the audited events without free-text
 *      personal data. D-108 sets the target to a random request ID (never the Feide ID, the `sub` or a learner key) and
 *      the actor to the operator's staff account; its amendment of 2026-11-04 fixes the actions and the details.
 * Spec: DATA-008, DATA-007
 * Invariants:
 *   - Actions `dataSubject.export` and `dataSubject.erase`; target type `DataSubjectRequest`; target ID a random UUID.
 *   - PRIVACY: `details` hold only `dryRun`, `outcome`, `years`, `identifiers`, `counts`, `unreachableYears` and, after
 *     an erasure, `remaining`: numbers, years and fixed words, never an identifier, key or hash (DATA-007, DATA-002).
 *   - A refused run is audited without an actor: the operator was not accepted, so no account is named.
 * Collaborators: ./dataSubjectRequest.ts (the caller), ../../infra/prismaClient.ts.
 * Tests: apps/server/test/privacy/dsr/dataSubjectRequest.int.test.ts,
 *   apps/server/test/privacy/dsr/dataSubjectErasure.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';

/** The audit action of an export (the right of access). */
export const DSR_EXPORT_ACTION = 'dataSubject.export';
/** The audit action of an erasure, dry run or real. */
export const DSR_ERASE_ACTION = 'dataSubject.erase';
/** The audit target type: the request, by its random ID. */
export const DSR_TARGET_TYPE = 'DataSubjectRequest';

/** What a request does. */
export type DsrAction = 'export' | 'erase';

/** How a run ended. */
export type DsrOutcome = 'completed' | 'failed' | 'refused';

/** The details of a data-subject audit event. */
export interface DsrAuditDetails {
  /** True for an erasure without `--confirm`, and for every export (it changes nothing). */
  readonly dryRun: boolean;
  readonly outcome: DsrOutcome;
  /** The academic years searched (the configured secrets'). */
  readonly years: readonly number[];
  /** How many Feide IDs and Canvas identities the request gave. */
  readonly identifiers: { readonly feide: number; readonly lti: number };
  /** Rows exported, deleted, or that a dry run would delete, per table. */
  readonly counts: Readonly<Record<string, number>>;
  /** Stored academic years that no configured secret covers. */
  readonly unreachableYears: readonly number[];
  /** After an erasure: rows under the keys found again (written while it ran). */
  readonly remaining?: Readonly<Record<string, number>>;
}

/** One audit event of a request. */
export interface DsrAuditEvent {
  /** The random request ID. */
  readonly requestId: string;
  readonly action: DsrAction;
  /** The operator's `User.id`; null when the run was refused. */
  readonly actorUserId: string | null;
  readonly details: DsrAuditDetails;
}

/**
 * Writes the audit event of one run.
 * @param db - The database.
 * @param event - The request ID, the action, the operator and the details.
 * @returns When the event is stored.
 * @spec DATA-008
 */
export async function auditDataSubjectRequest(
  db: Pick<Database, 'auditEvent'>,
  event: DsrAuditEvent,
): Promise<void> {
  const { details } = event;
  await db.auditEvent.create({
    data: {
      actorUserId: event.actorUserId,
      action: event.action === 'export' ? DSR_EXPORT_ACTION : DSR_ERASE_ACTION,
      targetType: DSR_TARGET_TYPE,
      // PRIVACY: a random ID; only HVL's case record links it to the person (D-108).
      targetId: event.requestId,
      // PRIVACY: counts, years and fixed words only (DATA-007).
      details: {
        dryRun: details.dryRun,
        outcome: details.outcome,
        years: [...details.years],
        identifiers: { feide: details.identifiers.feide, lti: details.identifiers.lti },
        counts: { ...details.counts },
        unreachableYears: [...details.unreachableYears],
        ...(details.remaining === undefined ? {} : { remaining: { ...details.remaining } }),
      },
    },
  });
}
