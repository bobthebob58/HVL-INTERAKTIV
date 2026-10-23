/**
 * findings — the shape of `GET /api/content/:contentId/findings`: what the pre-publish validator found in the stored
 * activity, and which errors an author has already explained.
 *
 * Why: PROD-003 lists findings in plain language with a "Go to field" link, and UD-022 lets an author publish despite
 *      an error with a recorded reason, which is asked for again after 14 days. The web app shows each error with its
 *      acknowledgement, if one still holds, so the author sees what still needs a reason.
 * Spec: PROD-003, UD-022, UD-020, DOC-012
 * Invariants:
 *   - A finding has the fields of the server's `Finding` (apps/server/src/validation/types.ts); a server test checks
 *     that the two stay assignable.
 *   - `acknowledgement` is null for warnings and hints, and for an error without an acknowledgement younger than
 *     14 days; `expiresAt` is `at` plus 14 days.
 * Collaborators: ./apiRoutes.ts, ./publishing.ts, ./errors.ts, apps/server/src/content/, apps/web.
 * Tests: packages/api-contract/test/schemas.test.ts, apps/server/test/content/acknowledgementCoverage.test.ts
 */
import { z } from 'zod';

/** How much a finding matters: only `error` can block publishing (PROD-003). */
export const findingSeveritySchema = z.enum(['error', 'warning', 'hint']);
/** Error, warning or hint. */
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;

/** One problem the validator found, with its message in the person's language. */
export const findingSchema = z.strictObject({
  /** e.g. `V-IMG-ALT` or `PED-H05`. */
  ruleId: z.string().min(1),
  severity: findingSeveritySchema,
  /** The requirement the rule implements: `UD-021` or `PED-020`. */
  requirement: z.string(),
  /** A JSON path into the activity's parameters for "Go to field"; empty for the activity as a whole. */
  path: z.string(),
  /** Plain language; says what to do. */
  message: z.string(),
});
/** One problem the validator found. */
export type ApiFinding = z.infer<typeof findingSchema>;

/**
 * An author's recorded reason for publishing despite an error (UD-022), while it still holds.
 * @spec UD-022
 */
export const acknowledgementSchema = z.strictObject({
  reason: z.string(),
  at: z.iso.datetime(),
  /** After this moment the error blocks publishing again until someone gives a new reason. */
  expiresAt: z.iso.datetime(),
});
/** A recorded reason for an error. */
export type Acknowledgement = z.infer<typeof acknowledgementSchema>;

/** A finding with the acknowledgement that covers it, if any. */
export const findingWithAcknowledgementSchema = findingSchema.extend({
  acknowledgement: acknowledgementSchema.nullable(),
});
/** A finding with its acknowledgement. */
export type FindingWithAcknowledgement = z.infer<typeof findingWithAcknowledgementSchema>;

/**
 * `GET /api/content/:contentId/findings` → 200: the findings of the stored activity, and the `updatedAt` they were
 * computed for, which the publish request sends back.
 * @spec PROD-003
 */
export const findingsResponseSchema = z.strictObject({
  updatedAt: z.iso.datetime(),
  findings: z.array(findingWithAcknowledgementSchema),
});
/** The answer of `GET /api/content/:contentId/findings`. */
export type FindingsResponse = z.infer<typeof findingsResponseSchema>;
