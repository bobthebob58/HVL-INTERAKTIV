/**
 * insightFindings — the answer of `GET /api/content/:contentId/insight/findings`: the activity's current validator
 * findings and acknowledgements, for everyone who may see its insight.
 *
 * Why: INS-010 shows the validator's findings and acknowledgements (UD-022) beside the results, so accessibility debt
 *      stays visible. The check tab's route (`GET …/findings`, PROD-003) is for editors only, while a Canvas teacher of
 *      a course the activity is placed in may see its insight without editing it (D-106, LTI-007), so insight has its
 *      own route with the same findings. An acknowledgement's reason is an author's own text, which the data
 *      inventory shows to the activity's editors only, so for anyone else it is null: they see that, when and until
 *      when an error was acknowledged, not why.
 * Spec: INS-010, UD-022, PROD-003
 * Invariants:
 *   - Same shape as ./findings.ts's `findingsResponseSchema`, except that `acknowledgement.reason` may be null.
 *   - PRIVACY: no field names who acknowledged an error (DATA-007 keeps that in the audit log).
 * Collaborators: ./findings.ts, ./routes/insightRoutes.ts, apps/server/src/insight/http/insightFindingsAnswer.ts.
 * Tests: packages/api-contract/test/insightReportSchemas.test.ts
 */
import { z } from 'zod';
import { acknowledgementSchema, findingSchema } from './findings.js';

/** An acknowledgement as insight shows it: the reason only to those who may edit the activity, else null. */
export const insightAcknowledgementSchema = acknowledgementSchema.extend({ reason: z.string().nullable() });
/** An acknowledgement in insight. */
export type InsightAcknowledgement = z.infer<typeof insightAcknowledgementSchema>;

/** A finding with the acknowledgement that covers it, if any. */
export const insightFindingSchema = findingSchema.extend({
  acknowledgement: insightAcknowledgementSchema.nullable(),
});
/** A finding in insight. */
export type InsightFinding = z.infer<typeof insightFindingSchema>;

/**
 * `GET /api/content/:contentId/insight/findings` → 200: the stored activity's findings and when it was last changed.
 * @spec INS-010
 */
export const insightFindingsResponseSchema = z.strictObject({
  updatedAt: z.iso.datetime(),
  findings: z.array(insightFindingSchema),
});
/** The findings answer of insight. */
export type InsightFindingsResponse = z.infer<typeof insightFindingsResponseSchema>;
