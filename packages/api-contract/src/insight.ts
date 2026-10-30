/**
 * insight — the shapes every insight answer shares: the fixed periods, the context and version a view covers, and a
 * cell that is either shown with its value or suppressed with no value at all.
 *
 * Why: INS-006 hides any value about fewer than k distinct learners, and the API answer carries no value for it
 *      (D-106), so a suppressed cell is `{ suppressed: true }` and nothing else. D-106 allows only fixed periods, each
 *      from midnight Oslo time, so two overlapping views cannot isolate one learner, and one context at a time: a
 *      Canvas course as `<platformId>:<contextId>` (D-103) or the portal's plays. The INS-001…INS-005 answers (step 4)
 *      are built from these parts.
 * Spec: INS-006, INS-007, INS-001, PROD-013
 * Invariants:
 *   - A suppressed cell has exactly one key, `suppressed: true`; a shown cell has `suppressed: false` and `value`.
 *     Nothing tells a cell hidden below k apart from one hidden so that it cannot be worked out from a total.
 *   - SPEC-DEVIATION: D-106 — the period is `7d`, `14d`, `30d` or `semester`, never a free date; `7d` by default.
 *   - PRIVACY: no shape here has a learner key, attempt ID, account or per-learner row (INS-006).
 *   - k is at least 3 (INS-006); a measure an activity type cannot send is null, never 0 (D-115).
 * Collaborators: ./gradeSync.ts (whose counts are exempt from suppression), apps/server/src/privacy/minimumGroupSize.ts,
 *   apps/server (the insight routes, step 4), apps/web (the Innsikt tabs).
 * Tests: packages/api-contract/test/insightSchemas.test.ts
 */
import { z } from 'zod';

/** The fixed periods of a view (D-106): the last 7, 14 or 30 days, or since the semester started. */
export const INSIGHT_PERIODS = ['7d', '14d', '30d', 'semester'] as const;
/** A period. */
export type InsightPeriod = (typeof INSIGHT_PERIODS)[number];
/** The period of «Før samlinga» when none is chosen (spec 05 §1). */
export const DEFAULT_INSIGHT_PERIOD: InsightPeriod = '7d';
/** The smallest k the server may be configured with (INS-006). */
export const INSIGHT_MIN_K = 3;
/** The context key of the portal's plays, which have no Canvas course. */
export const PORTAL_CONTEXT_KEY = 'portal';
/** `<LtiPlatform.id>:<context ID>` (D-103): a lower-case UUID, a colon and the launch's context ID. */
export const PLATFORM_CONTEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.{1,255}$/;

/** A fixed period. */
export const insightPeriodSchema = z
  .enum(INSIGHT_PERIODS)
  .describe('`7d`, `14d` or `30d` (the last days, from midnight Oslo time) or `semester` (D-106).');

/** The context a view covers: a Canvas course (D-103) or `portal`. */
export const insightContextKeySchema = z
  .union([z.literal(PORTAL_CONTEXT_KEY), z.string().regex(PLATFORM_CONTEXT)])
  .describe('`portal`, or a Canvas course as `<platformId>:<contextId>` (D-103).');
/** A context key. */
export type InsightContextKey = z.infer<typeof insightContextKeySchema>;

/** A context the activity has, as a view names it. */
export const insightContextSchema = z.strictObject({
  key: insightContextKeySchema,
  /** The course label from the launch (`LtiPlacement.contextLabel`, e.g. `SYK110`); null for the portal or none. */
  label: z.string().nullable(),
});
/** A context. */
export type InsightContext = z.infer<typeof insightContextSchema>;

/** The query of every insight view; in `/app/play` the launch fixes the context (D-106). */
export const insightQuerySchema = z.strictObject({
  period: insightPeriodSchema.optional(),
  context: insightContextKeySchema.optional(),
  /** A content version from 1 up to the current one (PROD-013); the current one by default. */
  version: z
    .string()
    .regex(/^[1-9][0-9]{0,8}$/)
    .optional(),
});
/** An insight query. */
export type InsightQuery = z.infer<typeof insightQuerySchema>;

/** What one view covers; every insight answer starts with it. */
export const insightScopeSchema = z.strictObject({
  contentId: z.uuid(),
  contentVersion: z.int().min(1),
  /** The newest version, so the view can offer the older ones (PROD-013). */
  currentVersion: z.int().min(1),
  context: insightContextSchema,
  period: insightPeriodSchema,
  /** Midnight Oslo time at the period's start (D-106). */
  periodStart: z.iso.datetime(),
  /** When the view was computed. */
  periodEnd: z.iso.datetime(),
  /** The minimum group size used; a suppressed cell is shown as «< k». */
  k: z.int().min(INSIGHT_MIN_K),
});
/** What a view covers. */
export type InsightScope = z.infer<typeof insightScopeSchema>;

/** A value hidden by INS-006: about fewer than k learners, or one a total would reveal. It carries no number. */
export const insightSuppressedCellSchema = z.strictObject({ suppressed: z.literal(true) });
/** A suppressed cell. */
export type InsightSuppressedCell = z.infer<typeof insightSuppressedCellSchema>;

/**
 * A cell that is shown with its value or suppressed without one.
 * @param value - The schema of a shown value.
 * @returns The cell schema, discriminated by `suppressed`.
 * @spec INS-006
 */
export const insightCellSchema = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion('suppressed', [
    z.strictObject({ suppressed: z.literal(false), value }),
    insightSuppressedCellSchema,
  ]);

/** A count of distinct learners. */
export const insightCountCellSchema = insightCellSchema(z.int().min(0));
/** A count cell. */
export type InsightCountCell = z.infer<typeof insightCountCellSchema>;
/** A share from 0 to 1, e.g. the completion rate or the share correct (INS-001, INS-002). */
export const insightRateCellSchema = insightCellSchema(z.number().min(0).max(1));
/** A rate cell. */
export type InsightRateCell = z.infer<typeof insightRateCellSchema>;
/** A median, e.g. minutes on task or attempts (INS-001). */
export const insightMedianCellSchema = insightCellSchema(z.number().min(0));
/** A median cell. */
export type InsightMedianCell = z.infer<typeof insightMedianCellSchema>;
