/**
 * dataSubjectRequest — runs one data-subject request: checks the operator, derives the person's keys, then exports,
 * counts (dry run) or erases their learner data, and audits the run.
 *
 * Why: DATA-008 asks for an admin-only tool that takes a Feide ID or an `(iss, sub)` pair, derives the learner keys for
 *      the retained academic years, and exports or deletes that learner's data, every use audited. D-108 makes it a
 *      server CLI for HVL operations; this is the part the CLI and the tests share.
 * Spec: DATA-008, DATA-007, DATA-002
 * Invariants:
 *   - No configured pseudonym secret → `NoPseudonymSecretsError` before the database is touched.
 *   - The operator is checked before any learner row is read; a refusal is audited without an actor.
 *   - An erasure deletes only with `confirm`; otherwise it counts what it would delete and changes nothing.
 *   - Every run that passes the secrets check writes exactly one audit event: `completed`, `refused`, or `failed` with
 *     what it had done; a failed run then rethrows its error.
 *   - PRIVACY: the identifiers stay in memory; the summary and the audit hold counts, years and fixed words only.
 * Collaborators: ./subjectKeys.ts, ./dsrOperator.ts, ./subjectRows.ts, ./subjectExport.ts, ./subjectErasure.ts,
 *   ./dsrAudit.ts, ./dsrCli.ts (the caller).
 * Tests: apps/server/test/privacy/dsr/dataSubjectRequest.int.test.ts,
 *   apps/server/test/privacy/dsr/dataSubjectErasure.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { Database } from '../../infra/prismaClient.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';
import type { PseudonymSecrets } from '../pseudonymSecrets.js';
import type { DataSubject } from './dataSubject.js';
import {
  auditDataSubjectRequest,
  type DsrAction,
  type DsrAuditDetails,
  type DsrOutcome,
} from './dsrAudit.js';
import { checkOperator } from './dsrOperator.js';
import { eraseSubject } from './subjectErasure.js';
import { exportCounts, exportSubject, type SubjectExport } from './subjectExport.js';
import { deriveSubjectKeys } from './subjectKeys.js';
import {
  countSubjectRows,
  emptySubjectCounts,
  findSubjectAccounts,
  unreachableYears,
} from './subjectRows.js';

/** What a request uses. */
export interface DsrDeps {
  readonly db: Database;
  /** `PSEUDONYM_SECRETS`. */
  readonly secrets: PseudonymSecrets;
  /** The identity hasher (`IDENTITY_HASH_KEYS`). */
  readonly hasher: IdentityHasher;
  /** `ADMIN_FEIDE_IDS`. */
  readonly adminFeideIds: readonly string[];
  /** The run's moment. */
  readonly now: Date;
  /** Makes the request ID; a random UUID unless a test fixes it. */
  readonly newRequestId?: () => string;
}

/** One request, as the operator gave it. */
export interface DsrCommand {
  readonly action: DsrAction;
  /** The operator's own Feide ID (an HVL admin). */
  readonly operatorFeideId: string;
  /** Erasure only: delete for real; without it the erasure is a dry run. */
  readonly confirm: boolean;
  readonly subject: DataSubject;
}

/** What a completed run reports: counts, years and fixed words only. */
export interface DsrSummary extends Omit<DsrAuditDetails, 'outcome'> {
  readonly requestId: string;
  readonly action: DsrAction;
  readonly outcome: 'completed';
  /** Staff accounts the identifiers match, left alone (D-108). */
  readonly staffAccounts: number;
  /** Identities on the matched learner accounts that no identifier given matches. */
  readonly otherIdentities: number;
}

/** The result of a run that did not fail. */
export type DsrResult =
  | {
      readonly outcome: 'refused';
      readonly requestId: string;
      readonly reason: 'not-an-admin' | 'no-staff-account';
    }
  | { readonly outcome: 'completed'; readonly summary: DsrSummary; readonly document?: SubjectExport };

/** Rows of any covered table remaining. */
const anyRows = (counts: Readonly<Record<string, number>>): boolean =>
  Object.values(counts).some((n) => n > 0);

/**
 * Runs one data-subject request and audits it.
 * @param deps - Database, secrets, hasher, admin list and moment.
 * @param command - The action, the operator, `confirm` and the data subject.
 * @returns The refusal, or the summary (and, for an export, the document).
 * @throws NoPseudonymSecretsError without secrets (nothing audited, nothing read); whatever the database throws,
 *   after the run is audited as failed.
 * @spec DATA-008
 */
export async function runDataSubjectRequest(deps: DsrDeps, command: DsrCommand): Promise<DsrResult> {
  const keys = deriveSubjectKeys(command.subject, deps.secrets, deps.hasher);
  const requestId = (deps.newRequestId ?? randomUUID)();
  const { action } = command;
  const dryRun = action === 'export' || !command.confirm;
  let counts: Readonly<Record<string, number>> = {};
  let unreachable: number[] = [];
  const audit = (outcome: DsrOutcome, actorUserId: string | null, remaining?: Record<string, number>) =>
    auditDataSubjectRequest(deps.db, {
      requestId,
      action,
      actorUserId,
      details: {
        dryRun,
        outcome,
        years: keys.years,
        identifiers: keys.identifiers,
        counts,
        unreachableYears: unreachable,
        ...(remaining === undefined ? {} : { remaining }),
      },
    });

  const operator = await checkOperator(deps, command.operatorFeideId);
  if (!operator.accepted) {
    await audit('refused', null);
    return { outcome: 'refused', requestId, reason: operator.reason };
  }
  try {
    const accounts = await findSubjectAccounts(deps.db, keys);
    unreachable = await unreachableYears(deps.db, keys.years);
    let document: SubjectExport | undefined;
    let remaining: Record<string, number> | undefined;
    if (action === 'export') {
      document = await exportSubject(deps.db, keys, accounts, { requestId, at: deps.now });
      counts = exportCounts(document);
    } else if (dryRun) {
      counts = await countSubjectRows(deps.db, keys, accounts);
    } else {
      const tally = emptySubjectCounts();
      counts = tally;
      await eraseSubject(deps.db, keys, accounts, { requestId, operatorUserId: operator.userId }, tally);
      // WHY: a learner still in a portal session (up to 12 hours, D-057) may have written rows meanwhile.
      remaining = await countSubjectRows(deps.db, keys, await findSubjectAccounts(deps.db, keys));
    }
    await audit('completed', operator.userId, remaining);
    const summary: DsrSummary = {
      requestId,
      action,
      dryRun,
      outcome: 'completed',
      years: keys.years,
      identifiers: keys.identifiers,
      counts: { ...counts },
      staffAccounts: accounts.staffAccounts,
      otherIdentities: accounts.otherIdentities,
      unreachableYears: unreachable,
      ...(remaining === undefined ? {} : { remaining }),
    };
    return document === undefined
      ? { outcome: 'completed', summary }
      : { outcome: 'completed', summary, document };
  } catch (error) {
    // WHY: a failed run is audited with what it did; if even that write fails, the run's own error is reported.
    await audit('failed', operator.userId).catch(() => undefined);
    throw error;
  }
}

/**
 * Tells whether an erasure found rows under the keys after it ran (written while it ran).
 * @param summary - A completed run's summary.
 * @returns True when an erasure's `remaining` counts any row.
 * @spec DATA-008
 */
export const hasRemainingRows = (summary: DsrSummary): boolean =>
  summary.remaining !== undefined && anyRows(summary.remaining);
