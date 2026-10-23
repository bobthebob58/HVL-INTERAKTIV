/**
 * publishing — the shapes of `POST /api/content/:contentId/publish` and `POST /api/content/:contentId/unpublish`.
 *
 * Why: PROD-003 publishes an activity only when every error is fixed or explained, and D-074 makes the request carry
 *      the `updatedAt` the author checked, so an activity changed in the meantime is never published unseen. The
 *      server validates the stored activity again; the request carries only the reasons, never findings.
 * Spec: PROD-003, UD-022, DOC-012
 * Invariants:
 *   - A reason is trimmed and 1 to `REASON_MAX_LENGTH` characters long.
 *   - An acknowledgement names an error by `ruleId` and `path`, exactly as the findings gave them.
 * Collaborators: ./findings.ts, ./apiRoutes.ts, apps/server/src/http/api/publishRoutes.ts, apps/web.
 * Tests: packages/api-contract/test/schemas.test.ts
 */
import { z } from 'zod';

/** The longest reason an author may give (UD-022). */
export const REASON_MAX_LENGTH = 500;
/** The most acknowledgements one publish request may carry. */
export const MAX_ACKNOWLEDGEMENTS = 500;

/**
 * An author's reason for publishing despite one error (UD-022).
 * @spec UD-022
 */
export const acknowledgementInputSchema = z.strictObject({
  ruleId: z.string().min(1).max(100),
  path: z.string().max(1000),
  reason: z.string().trim().min(1).max(REASON_MAX_LENGTH),
});
/** One acknowledgement in a publish request. */
export type AcknowledgementInput = z.infer<typeof acknowledgementInputSchema>;

/**
 * `POST /api/content/:contentId/publish` body: the `updatedAt` from the findings the author saw, and a reason for
 * each error the author publishes despite.
 * @spec PROD-003
 */
export const publishRequestSchema = z.strictObject({
  updatedAt: z.iso.datetime(),
  acknowledgements: z.array(acknowledgementInputSchema).max(MAX_ACKNOWLEDGEMENTS),
});
/** The body of a publish request. */
export type PublishRequest = z.infer<typeof publishRequestSchema>;

/** `POST /api/content/:contentId/publish` → 200: the activity is published. */
export const publishResponseSchema = z.strictObject({
  status: z.literal('published'),
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime(),
});
/** The answer of a publish request. */
export type PublishResponse = z.infer<typeof publishResponseSchema>;

/** `POST /api/content/:contentId/unpublish` body: the `updatedAt` the author saw. */
export const unpublishRequestSchema = z.strictObject({ updatedAt: z.iso.datetime() });
/** The body of an unpublish request. */
export type UnpublishRequest = z.infer<typeof unpublishRequestSchema>;

/** `POST /api/content/:contentId/unpublish` → 200: the activity is a draft again. */
export const unpublishResponseSchema = z.strictObject({
  status: z.literal('draft'),
  updatedAt: z.iso.datetime(),
});
/** The answer of an unpublish request. */
export type UnpublishResponse = z.infer<typeof unpublishResponseSchema>;
