/**
 * errors — the shape of every `/api` error answer, and the publish-blocked answer that also carries findings.
 *
 * Why: the server answers every refusal in one shape with a stable machine code and a translated message
 *      (apps/server/src/http/h5pErrorResponse.ts), so the web app handles errors in one place. A blocked publish adds
 *      the findings, so the author sees at once which errors still need a reason (PROD-003).
 * Spec: PROD-003, PROD-012, DOC-012
 * Invariants:
 *   - `errorCode` is stable (e.g. `hvl:publish-blocked`); `message` is already in the person's language.
 *   - Only `hvl:publish-blocked` and `hvl:published-save-blocked` answers carry `findings`.
 * Collaborators: ./findings.ts, ./apiRoutes.ts, apps/server/src/http/h5pErrorResponse.ts.
 * Tests: packages/api-contract/test/schemas.test.ts
 */
import { z } from 'zod';
import { findingWithAcknowledgementSchema } from './findings.js';

/** Every `/api` error answer: H5P's AJAX error shape with a translated message. */
export const errorBodySchema = z.strictObject({
  success: z.literal(false),
  /** Stable machine code, e.g. `hvl:unauthenticated`, `hvl:content-changed`, `error.badRequest`. */
  errorCode: z.string(),
  httpStatusCode: z.int(),
  /** Already translated into the person's language. */
  message: z.string(),
});
/** An error answer. */
export type ErrorBody = z.infer<typeof errorBodySchema>;

/**
 * 409 `hvl:publish-blocked`: errors without a valid acknowledgement remain; `findings` are all current findings
 * with the acknowledgements stored so far.
 * @spec PROD-003
 */
export const publishBlockedBodySchema = errorBodySchema.extend({
  findings: z.array(findingWithAcknowledgementSchema),
});
/** A blocked publish or save. */
export type PublishBlockedBody = z.infer<typeof publishBlockedBodySchema>;

/** The 409 answers of publish and unpublish: blocked (with findings) or changed in the meantime (without). */
export const publishConflictBodySchema = z.union([publishBlockedBodySchema, errorBodySchema]);
/** A 409 answer of publish or unpublish. */
export type PublishConflictBody = z.infer<typeof publishConflictBodySchema>;
