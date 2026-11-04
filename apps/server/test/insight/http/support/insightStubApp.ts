/**
 * insightStubApp — the insight routes answering one fixed report as its owner sees them, with no database: the
 * activity facts and the audit store are stand-ins, so a test checks the HTTP boundary alone.
 *
 * Why: the INS-006 property test runs the routes on many random reports, and the audit-first test needs an audit
 *      write that fails; neither is about PostgreSQL, so both use this app rather than the database bench
 *      (./insightHttpBench.ts). The routes, the query and CSV code and the error handler are the server's own.
 * Spec: INS-006, INS-009, DATA-007
 * Invariants:
 *   - The principal is the activity's owner in the portal, with no rate limit; `forActivity` always answers the
 *     given report, and the contexts are never read except by the contexts route.
 *   - The audit store records each event's data, or rejects every write when `auditFails` is set.
 * Collaborators: ../../../../src/insight/http/insightRoutes.ts, ../../../../src/http/h5pErrorHandler.ts,
 *   ../../../grades/status/support/gradeSyncApp.ts (`portalPrincipal`, `NO_LIMIT`).
 * Tests: used by ../insightSuppressionApi.property.test.ts and ../insightAuditFirst.test.ts.
 */
import express, { type Express } from 'express';
import { setPrincipal } from '../../../../src/auth/principalLocals.js';
import type { ContentAccessRepository } from '../../../../src/h5p/permissions/ContentAccessRepository.js';
import { h5pErrorHandler } from '../../../../src/http/h5pErrorHandler.js';
import { insightRoutes } from '../../../../src/insight/http/insightRoutes.js';
import type { InsightReport } from '../../../../src/insight/insightReport.js';
import type { Database } from '../../../../src/infra/prismaClient.js';
import { createLogger } from '../../../../src/logging/logger.js';
import { NO_LIMIT, portalPrincipal } from '../../../grades/status/support/gradeSyncApp.js';

/** The owner the stub app's principal is. */
export const STUB_OWNER = 'stub-owner';

/** The stub app and what its audit store received. */
export interface InsightStubApp {
  readonly app: Express;
  /** The `data` of each audit event written, in order. */
  readonly audited: unknown[];
}

/**
 * Builds the routes answering one report.
 * @param report - What the insight core answers for every view.
 * @param options - `auditFails`: every audit write rejects, as a database that is down would.
 * @returns The app, with the routes under `/api`, and the audit events it wrote.
 */
export function insightStubApp(
  report: InsightReport,
  options: { readonly auditFails?: boolean } = {},
): InsightStubApp {
  const audited: unknown[] = [];
  const access: ContentAccessRepository = {
    factsFor: async (contentId) => ({
      contentId,
      ownerUserId: STUB_OWNER,
      coAuthorIds: [],
      status: 'published',
      visibility: 'private',
      bankListed: false,
    }),
  };
  // WHY: the boundary is under test, not the database: the audit write is the only call the owner's view makes.
  const auditEvent = {
    create: async ({ data }: { data: unknown }) => {
      if (options.auditFails) throw new Error('stub: the audit store is down');
      audited.push(data);
      return {};
    },
  };
  const app = express()
    .use((_req, res, next) => {
      setPrincipal(res, portalPrincipal(STUB_OWNER));
      next();
    })
    .use(
      '/api',
      insightRoutes({
        db: { auditEvent } as unknown as Database,
        access,
        findings: () => Promise.reject(new Error('not used')),
        services: { insight: { forActivity: async () => report, contexts: async () => [] }, limit: NO_LIMIT },
      }),
    )
    .use(h5pErrorHandler(createLogger({ level: 'silent' })));
  return { app, audited };
}
