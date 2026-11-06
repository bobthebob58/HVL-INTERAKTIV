/**
 * insightScope — what one insight view covers: one activity, one content version, one context and one fixed period,
 * resolved from a request into the stored values the statement query filters by.
 *
 * Why: D-106 shows one activity, one content version (the current one by default, PROD-013) and one context at a
 *      time: a Canvas course, stored as `<platformId>:<contextId>` (D-103), or the portal's plays (stored as no
 *      context). There is no view across contexts or versions, so a teacher cannot subtract one view from another.
 * Spec: INS-001, INS-006, PROD-013
 * Invariants:
 *   - The version is an integer from 1 up to the activity's current version; anything else is refused
 *     (`versionUnavailable`), never clamped, so a view never claims to show a version it does not.
 *   - The context is `portal` (stored as null) or a key `../../xapi/platformContextKey.ts` can parse; anything else
 *     is refused (`contextInvalid`). Whether the person may see that context is INS-007's check, made before this.
 *   - The scope carries *k*, so the answer says what «< k» means.
 *   - The period ends at the latest midnight in Oslo and lies within one academic year (./insightPeriod.ts), and the
 *     query reads only that year's rows (`academicYear`), so a learner has one key in a view (D-106's amendment).
 * Collaborators: ./insightPeriod.ts, ../../xapi/platformContextKey.ts, @hvl-interaktiv/api-contract (`insight.ts`),
 *   ../InsightService.ts, ../data/insightStatements.ts.
 * Tests: apps/server/test/insight/insightScope.test.ts
 */
import {
  DEFAULT_INSIGHT_PERIOD,
  PORTAL_CONTEXT_KEY,
  type InsightContext,
  type InsightContextKey,
  type InsightPeriod,
  type InsightScope,
} from '@hvl-interaktiv/api-contract';
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import { parsePlatformContextKey } from '../../xapi/platformContextKey.js';
import { insightPeriodRange } from './insightPeriod.js';

/** What a caller asks for; the API workstream builds it from the route, the query and the launch. */
export interface InsightScopeRequest {
  /** The activity, as stored (from the access check). */
  readonly contentId: string;
  /** `portal`, or a Canvas course as `<platformId>:<contextId>` (D-103). */
  readonly context: InsightContextKey;
  /** One of the fixed periods (D-106); `7d` when omitted. */
  readonly period?: InsightPeriod;
  /** A content version from 1 up to the current one (PROD-013); the current one when omitted. */
  readonly version?: number;
}

/** Why a scope cannot be resolved; the API answers 404 for the first and 400 for the others. */
export type InsightScopeProblem = 'activityUnavailable' | 'versionUnavailable' | 'contextInvalid';

/** A request that names no activity, version or context the view can cover. */
export class InsightScopeError extends Error {
  /**
   * @param reason - What is wrong.
   */
  constructor(readonly reason: InsightScopeProblem) {
    super(`insight scope refused: ${reason}`);
    this.name = 'InsightScopeError';
  }
}

/** A resolved scope: the contract's `InsightScope` plus the stored values the query filters by. */
export interface ResolvedInsightScope {
  /** What the answer reports (the contract's shape). */
  readonly view: InsightScope;
  /** `XapiStatement.contextId`: the platform-scoped key, or null for the portal's plays (D-103). */
  readonly storedContextId: string | null;
  /** From midnight Oslo time (inclusive). */
  readonly start: Date;
  /** Up to the latest midnight in Oslo (exclusive): the view holds no data of today (D-106). */
  readonly end: Date;
  /** `XapiStatement.academicYear` of the view: the year of its last day, so one key per learner (D-106, D-107). */
  readonly academicYear: number;
}

/**
 * The stored form of a context key.
 * @param key - `portal` or `<platformId>:<contextId>`.
 * @returns Null for the portal, the key itself for a Canvas course.
 * @throws InsightScopeError `contextInvalid` for anything else.
 * @spec INS-007
 */
export function storedContextOf(key: InsightContextKey): string | null {
  if (key === PORTAL_CONTEXT_KEY) return null;
  // SECURITY: only a well-formed platform-scoped key reaches the query; a bare course ID would match none (D-103).
  if (parsePlatformContextKey(key) === undefined) throw new InsightScopeError('contextInvalid');
  return key;
}

/**
 * Resolves a request against the activity's current version.
 * @param request - The activity, context, period and version asked for.
 * @param facts - The activity's current version, the context's course label (or null), *k*, and the moment now.
 * @returns The scope.
 * @throws InsightScopeError `versionUnavailable` or `contextInvalid`.
 * @spec PROD-013
 */
export function resolveInsightScope(
  request: InsightScopeRequest,
  facts: {
    readonly currentVersion: number;
    readonly contextLabel: string | null;
    readonly size: MinimumGroupSize;
    readonly now: Date;
  },
): ResolvedInsightScope {
  const version = request.version ?? facts.currentVersion;
  if (!Number.isInteger(version) || version < 1 || version > facts.currentVersion) {
    throw new InsightScopeError('versionUnavailable');
  }
  const storedContextId = storedContextOf(request.context);
  const period = request.period ?? DEFAULT_INSIGHT_PERIOD;
  const { start, end, academicYear } = insightPeriodRange(period, facts.now);
  const context: InsightContext = {
    key: request.context,
    label: storedContextId === null ? null : facts.contextLabel,
  };
  return {
    view: {
      contentId: request.contentId,
      contentVersion: version,
      currentVersion: facts.currentVersion,
      context,
      period,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      k: facts.size.k,
    },
    storedContextId,
    start,
    end,
    academicYear,
  };
}
