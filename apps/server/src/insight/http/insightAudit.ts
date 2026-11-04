/**
 * insightAudit — writes the audit event of an insight view (`insight.view`) or CSV download (`insight.export`).
 *
 * Why: DATA-007 audits insight views and exports, INS-007 writes an event for each view, and spec 00 §8 measures from
 *      the audit log whether pilot teachers opened «Før samlinga» before their seminars. D-106 limits the details to
 *      the view, the period, the context and the content version, which is enough for that measure.
 * Spec: DATA-007, INS-007, INS-009
 * Invariants:
 *   - PRIVACY: `details` has exactly `view`, `period`, `context` (D-103's `<platformId>:<contextId>`, or `portal`)
 *     and `contentVersion`: no learner key, count, answer or free text (DATA-007). The target is the activity
 *     (`H5PContent`), the actor the person who looked.
 *   - The event is written before the answer is sent, so a view whose event cannot be written fails (500) and shows
 *     nothing: there is never an unaudited view.
 * Collaborators: ./insightRoutes.ts, ../../infra/prismaClient.ts, @hvl-interaktiv/api-contract (`InsightScope`).
 * Tests: apps/server/test/insight/http/insightRoutes.int.test.ts,
 *   apps/server/test/insight/http/insightAuditFirst.test.ts
 */
import type { InsightScope } from '@hvl-interaktiv/api-contract';
import type { Database } from '../../infra/prismaClient.js';

/** The audit action of an insight view (DATA-007). */
export const INSIGHT_VIEW_ACTION = 'insight.view';
/** The audit action of an insight CSV download (DATA-007, INS-009). */
export const INSIGHT_EXPORT_ACTION = 'insight.export';
/** The name of the one insight view, «Før samlinga» (spec 05 §1), as the audit details give it. */
export const INSIGHT_VIEW_NAME = 'beforeSession';

/** An insight audit action. */
export type InsightAuditAction = typeof INSIGHT_VIEW_ACTION | typeof INSIGHT_EXPORT_ACTION;

/** The details of an insight audit event: what was looked at, never what it showed. */
export interface InsightAuditDetails {
  readonly view: typeof INSIGHT_VIEW_NAME;
  readonly period: InsightScope['period'];
  readonly context: string;
  readonly contentVersion: number;
}

/**
 * The details of an event for one view, built from the view's scope only.
 * @param scope - The scope the answer reports.
 * @returns The four details D-106 allows.
 * @spec DATA-007
 */
export const insightAuditDetails = (scope: InsightScope): InsightAuditDetails => ({
  view: INSIGHT_VIEW_NAME,
  period: scope.period,
  context: scope.context.key,
  contentVersion: scope.contentVersion,
});

/**
 * Writes the audit event of an insight view or export.
 * @param db - The database.
 * @param event - The action, the person who looked, and the view's scope.
 * @returns When the event is stored.
 * @spec DATA-007
 */
export async function auditInsight(
  db: Database,
  event: { readonly action: InsightAuditAction; readonly actorUserId: string; readonly scope: InsightScope },
): Promise<void> {
  await db.auditEvent.create({
    data: {
      actorUserId: event.actorUserId,
      action: event.action,
      targetType: 'H5PContent',
      targetId: event.scope.contentId,
      details: { ...insightAuditDetails(event.scope) },
    },
  });
}
