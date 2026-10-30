/**
 * XapiIngest — receives one batch from the player's bridge: checks who sends it and about what, applies the rate
 * limit, stores a learner's statements once each (DATA-012) and hands the new rows to a listener after they commit.
 *
 * Why: LTI-011 validates and stores statements; D-102 stores them only from a learner principal, so an author's
 *      preview or a teacher's play never becomes learning data or a grade; D-115 fixes what is stored, the statement
 *      identity and the receive-time timestamps. The grade enqueuer (LTI-012) must see exactly the rows that are new,
 *      after they are stored, so it is a listener here rather than part of the insert.
 * Spec: LTI-011, DATA-012, LTI-012
 * Invariants:
 *   - Order: the activity check (403), the version check (400), the rate limit (429, nothing stored), then the
 *     learner check. Everyone gets the same answers, so a 202 never tells whose statements are kept (D-102).
 *   - PRIVACY: the learner comes from the principal, never the body: `learnerKey`, its academic year (D-107) and the
 *     platform-scoped context of the launch (D-103, null in the portal). Logs hold counts only (DATA-009).
 *   - PRIVACY: an LTI request's `sub` passes through to the listener only (D-104), never into a row or a log.
 *   - The listener gets only the rows this request inserted, in timestamp order, after the insert committed; its
 *     failure is logged by kind only and does not fail the batch, whose statements are stored (a resend would be
 *     skipped).
 * Collaborators: ./xapiTarget.ts, ./XapiRateLimit.ts, ./XapiStatementStore.ts, ./xapiBatchPlan.ts,
 *   ./platformContextKey.ts, ../auth/Principal.ts, ./xapiRoutes.ts, ../server/createApp.ts (wires the listener).
 * Tests: apps/server/test/xapi/xapiIngest.int.test.ts, apps/server/test/xapi/xapiLimits.int.test.ts,
 *   apps/server/test/xapi/xapiRouteAuth.int.test.ts
 */
import type { XapiBatchEnvelope } from '@hvl-interaktiv/api-contract';
import type { Logger } from 'pino';
import { highestRole, learnerKeyYearOf, type Principal } from '../auth/Principal.js';
import type { XapiStatement } from '../generated/prisma/client.js';
import type { ContentAccessRepository } from '../h5p/permissions/ContentAccessRepository.js';
import { HttpError } from '../http/HttpError.js';
import type { Database } from '../infra/prismaClient.js';
import { isPrismaError, prismaErrorLine } from '../logging/prismaErrorSummary.js';
import { principalContextKey } from './platformContextKey.js';
import { batchKeys, parseXapiItems, planXapiBatch, type XapiBatchPlan } from './xapiBatchPlan.js';
import type { StatementLimit } from './XapiRateLimit.js';
import type { XapiStatementStore } from './XapiStatementStore.js';
import type { XapiBatchFacts } from './xapiStatementRow.js';
import { xapiTarget } from './xapiTarget.js';

/** What the request knows beyond the principal, for the listener only. */
export interface XapiRequestFacts {
  /**
   * The launch's `sub` of an LTI request (`ltiSubjectOf`), which AGS needs as `userId` (D-104). PRIVACY: never stored
   * here or logged; the enqueuer stores it encrypted only (DATA-002).
   */
  readonly ltiSubject?: string | undefined;
}

/**
 * Called with the rows a batch stored, after they are committed; the grade enqueuer (LTI-012, D-104) hangs off it.
 * @param rows - The new rows, oldest first; never empty.
 * @param principal - The learner who sent them (an LTI learner's launch facts included).
 * @param request - The request's LTI `sub`, when it came from Canvas; a listener that needs none may omit it.
 */
export type XapiStoredListener = (
  rows: XapiStatement[],
  principal: Principal,
  request: XapiRequestFacts,
) => Promise<void>;

/** What the ingestion needs. */
export interface XapiIngestDeps {
  readonly access: ContentAccessRepository;
  readonly db: Database;
  readonly statements: Pick<XapiStatementStore, 'storedIds' | 'replayHistory' | 'insert'>;
  readonly rateLimit: StatementLimit;
  /** The server's clock; the receive time of every batch (D-115). */
  readonly clock: () => Date;
  readonly logger: Logger;
  /** The listener of stored rows; none until the integrator wires the grade enqueuer. */
  readonly onStored?: XapiStoredListener;
}

/** How a batch went: accepted (202), or refused by the rate limit (429 with `Retry-After`). */
export type XapiIngestOutcome =
  | { readonly kind: 'accepted'; readonly stored: number }
  | { readonly kind: 'limited'; readonly retryAfterSeconds: number };

/** Stores batches of xAPI statements. */
export class XapiIngest {
  /**
   * @param deps - Activity facts, database, statement store, rate limit, clock, logger and the optional listener.
   */
  constructor(private readonly deps: XapiIngestDeps) {}

  /**
   * Takes one batch.
   * @param principal - Who sends it (authenticated by `requestPrincipal`).
   * @param batch - The envelope, already checked by the contract's envelope schema; items are still unchecked.
   * @param request - What the request knows beyond the principal (an LTI `sub`), passed to the listener only.
   * @returns Accepted with the number of new rows, or limited with the seconds to wait.
   * @throws HttpError 403 `error.forbidden` (activity unknown, not viewable or not the launched one); 400
   *   `error.badRequest` (a content version above the current one).
   * @spec LTI-011
   */
  async ingest(
    principal: Principal,
    batch: XapiBatchEnvelope,
    request: XapiRequestFacts = {},
  ): Promise<XapiIngestOutcome> {
    const receivedAt = this.deps.clock();
    const target = await xapiTarget(this.deps, principal, batch.contentId);
    // WHY: a page opened before a structural save keeps its version; a later one does not exist yet (D-093, D-115).
    if (batch.contentVersion > target.currentVersion) throw new HttpError(400, 'error.badRequest');
    const count = batch.statements.length;
    const decision = await this.deps.rateLimit.take(principal.userId, target.contentId, count);
    if (!decision.allowed) return { kind: 'limited', retryAfterSeconds: decision.retryAfterSeconds };
    // PRIVACY: previews and teachers' plays are not learning data; their batches store nothing (D-102).
    if (highestRole(principal.roles) !== 'learner') return { kind: 'accepted', stored: 0 };
    const facts: XapiBatchFacts = {
      contentId: target.contentId,
      contentVersion: batch.contentVersion,
      contextId: principalContextKey(principal),
      learnerKey: principal.learnerKey,
      academicYear: learnerKeyYearOf(principal, receivedAt),
      mainCategory: target.mainCategory,
    };
    const items = parseXapiItems(batch.statements);
    const keys = batchKeys(items);
    const [storedIds, history] = await Promise.all([
      this.deps.statements.storedIds(keys.statementIds),
      this.deps.statements.replayHistory(facts, keys.viewIds),
    ]);
    const plan = planXapiBatch({
      items,
      facts,
      mainLibrary: target.mainLibrary,
      storedIds,
      history,
      receivedAt,
    });
    const inserted = await this.deps.statements.insert(plan.rows);
    const rows = inserted.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.logBatch(count, rows.length, plan);
    await this.notify(rows, principal, request);
    return { kind: 'accepted', stored: rows.length };
  }

  private logBatch(received: number, stored: number, plan: XapiBatchPlan): void {
    const { invalid, otherActivity } = plan.discarded;
    // PRIVACY: counts only, never a statement, an answer or a learner key (DATA-009, D-115).
    const record = { event: 'xapi.batch', received, stored, discarded: plan.discarded };
    if (invalid + otherActivity > 0) this.deps.logger.info(record, 'xapi batch had items that were refused');
    else this.deps.logger.debug(record, 'xapi batch stored');
  }

  private async notify(
    rows: XapiStatement[],
    principal: Principal,
    request: XapiRequestFacts,
  ): Promise<void> {
    if (rows.length === 0 || !this.deps.onStored) return;
    try {
      await this.deps.onStored(rows, principal, request);
    } catch (error) {
      // WHY: the rows are stored; failing the batch would only make the bridge resend what the insert now skips.
      // PRIVACY: the error's kind only (a Prisma error's code), since a message could name the learner (DATA-009).
      const kind = isPrismaError(error)
        ? prismaErrorLine(error)
        : error instanceof Error
          ? error.name
          : 'unknown';
      this.deps.logger.error(
        { event: 'xapi.listener.failed', rows: rows.length, kind },
        'xapi listener failed',
      );
    }
  }
}
