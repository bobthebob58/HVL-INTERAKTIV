/**
 * ContentPublisher — the findings, publish and unpublish steps of the check-and-publish gate (PROD-003).
 *
 * Why: D-074 validates the stored activity again on publish, lets an author publish despite an error only with a
 *      reason younger than 14 days or given now (UD-022), and makes the status change, the new acknowledgements and
 *      the audit record one transaction that applies only if the activity is still the version the author checked.
 * Spec: PROD-003, UD-022, DATA-007
 * Invariants:
 *   - The caller has checked Edit permission (H5P-006) and passes the canonical activity ID.
 *   - The findings always come from the validator on the stored activity, never from the request.
 *   - Publish and unpublish apply only while `updatedAt` equals the request's; otherwise 409 `hvl:content-changed`
 *     and nothing is written.
 *   - A publish holds the activity's ContentWriteLock from its read to its commit, as a save does from the gate to
 *     Lumi's write (./PublishedSaveGate.ts), so a save never lands unvalidated on an activity the publish just made
 *     visible (D-074). Unpublishing needs no lock: hiding an activity never shows unvalidated content.
 *   - Audit details hold rule IDs, the previous status and the mode only, never a reason (DATA-007).
 * Collaborators: ./storedContent.ts, ./acknowledgementCoverage.ts, ./PublishBlockedError.ts, ./ContentWriteLock.ts,
 *   ../http/api/publishRoutes.ts.
 * Tests: apps/server/test/http/api/publishRoutes.int.test.ts, apps/server/test/http/api/publishGuards.int.test.ts,
 *   apps/server/test/content/saveRace.int.test.ts
 */
import type {
  FindingsResponse,
  PublishRequest,
  PublishResponse,
  UnpublishRequest,
  UnpublishResponse,
} from '@hvl-interaktiv/api-contract';
import type { AuthMode } from '../auth/Principal.js';
import { authError } from '../http/authErrors.js';
import type { Locale } from '../i18n/translate.js';
import { decidePublish, withAcknowledgements } from './acknowledgementCoverage.js';
import { IN_PROCESS_WRITE_LOCK } from './ContentWriteLock.js';
import type { PublishingDeps } from './publishingDeps.js';
import { PublishBlockedError } from './PublishBlockedError.js';
import { recentAcknowledgements, validateStoredContent } from './storedContent.js';

/** Who publishes: the account, how they signed in, and the language of the findings. */
export interface Publisher {
  readonly userId: string;
  readonly mode: AuthMode;
  readonly locale: Locale;
}

const sameMoment = (stored: Date, requested: string): boolean => stored.getTime() === Date.parse(requested);

/** Findings, publish and unpublish of one activity. */
export class ContentPublisher {
  /**
   * @param deps - Database, validator and clock.
   */
  constructor(private readonly deps: PublishingDeps) {}

  /**
   * Validates the stored activity and annotates each error with the acknowledgement that still covers it.
   * @param contentId - The canonical activity ID.
   * @param locale - The language of the messages.
   * @returns The findings and the `updatedAt` they belong to.
   * @spec PROD-003
   */
  async findings(contentId: string, locale: Locale): Promise<FindingsResponse> {
    const now = this.deps.clock();
    const { row, findings } = await validateStoredContent(this.deps, contentId, locale);
    const stored = await recentAcknowledgements(this.deps.db, row.id, now);
    return { updatedAt: row.updatedAt.toISOString(), findings: withAcknowledgements(findings, stored, now) };
  }

  /**
   * Publishes the stored activity when every error is fixed or acknowledged.
   * @param contentId - The canonical activity ID.
   * @param by - Who publishes.
   * @param request - The checked `updatedAt` and the new acknowledgements.
   * @returns The new status, `updatedAt` and `publishedAt`.
   * @throws HttpError 409 `hvl:content-changed` (also when a save holds the activity for longer than the lock's
   *   wait), 400 `hvl:acknowledgement-invalid`; PublishBlockedError (409).
   * @spec PROD-003
   */
  async publish(contentId: string, by: Publisher, request: PublishRequest): Promise<PublishResponse> {
    const lock = this.deps.writeLock ?? IN_PROCESS_WRITE_LOCK;
    return lock.hold(contentId, () => this.publishLocked(contentId, by, request));
  }

  private async publishLocked(
    contentId: string,
    by: Publisher,
    request: PublishRequest,
  ): Promise<PublishResponse> {
    const { db } = this.deps;
    const now = this.deps.clock();
    const { row, findings } = await validateStoredContent(this.deps, contentId, by.locale);
    if (!sameMoment(row.updatedAt, request.updatedAt)) throw authError('hvl:content-changed');
    const stored = await recentAcknowledgements(db, row.id, now);
    const decision = decidePublish(findings, stored, request.acknowledgements, now);
    if (decision.kind === 'invalid') throw authError('hvl:acknowledgement-invalid');
    if (decision.kind === 'blocked') throw new PublishBlockedError(decision.findings);
    const { acknowledgements } = decision;
    return db.$transaction(async (tx) => {
      // WHY: the activity may have been saved after it was validated; publishing it then would publish unseen content.
      const { count } = await tx.h5PContent.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: { status: 'published', publishedAt: now },
      });
      if (count === 0) throw authError('hvl:content-changed');
      await tx.validationAcknowledgement.createMany({
        data: acknowledgements.map(({ ruleId, path, reason }) => ({
          contentId: row.id,
          ruleId,
          path,
          reason,
          userId: by.userId,
          at: now,
        })),
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: by.userId,
          action: 'content.publish',
          targetType: 'H5PContent',
          targetId: row.id,
          // PRIVACY: rule IDs only; the reasons are free text and stay in ValidationAcknowledgement (DATA-007).
          details: {
            from: row.status,
            acknowledgedRuleIds: acknowledgements.map((a) => a.ruleId).sort(),
            mode: by.mode,
          },
        },
      });
      const after = await tx.h5PContent.findUniqueOrThrow({
        where: { id: row.id },
        select: { updatedAt: true },
      });
      return {
        status: 'published' as const,
        updatedAt: after.updatedAt.toISOString(),
        publishedAt: now.toISOString(),
      };
    });
  }

  /**
   * Returns an activity to draft, so learners no longer see it.
   * @param contentId - The canonical activity ID.
   * @param by - Who unpublishes.
   * @param request - The checked `updatedAt`.
   * @returns The new status and `updatedAt`.
   * @throws HttpError 409 `hvl:content-changed`; 404 `hvl:activity-unavailable` when it has disappeared.
   */
  async unpublish(contentId: string, by: Publisher, request: UnpublishRequest): Promise<UnpublishResponse> {
    const { db } = this.deps;
    const row = await db.h5PContent.findUnique({
      where: { id: contentId },
      select: { id: true, status: true, updatedAt: true },
    });
    if (!row) throw authError('hvl:activity-unavailable');
    if (!sameMoment(row.updatedAt, request.updatedAt)) throw authError('hvl:content-changed');
    return db.$transaction(async (tx) => {
      const { count } = await tx.h5PContent.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: { status: 'draft', publishedAt: null },
      });
      if (count === 0) throw authError('hvl:content-changed');
      await tx.auditEvent.create({
        data: {
          actorUserId: by.userId,
          action: 'content.unpublish',
          targetType: 'H5PContent',
          targetId: row.id,
          details: { from: row.status, mode: by.mode },
        },
      });
      const after = await tx.h5PContent.findUniqueOrThrow({
        where: { id: row.id },
        select: { updatedAt: true },
      });
      return { status: 'draft' as const, updatedAt: after.updatedAt.toISOString() };
    });
  }
}
