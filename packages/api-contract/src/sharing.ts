/**
 * sharing — the shapes of `PATCH /api/content/:contentId/sharing`, which changes who can find an activity.
 *
 * Why: the S3 sharing route (PROD-006) is part of the `/api` surface, so DOC-012 asks for its schemas here too; the
 *      server validates its body with `sharingRequestSchema`.
 * Spec: PROD-006, DOC-012
 * Invariants:
 *   - The request changes visibility only; it can never publish (D-066, publishing is ./publishing.ts).
 * Collaborators: ./content.ts, ./apiRoutes.ts, apps/server/src/http/api/contentSharingRoutes.ts.
 * Tests: packages/api-contract/test/schemas.test.ts
 */
import { z } from 'zod';
import { visibilitySchema } from './content.js';

/**
 * `PATCH /api/content/:contentId/sharing` body: the new visibility.
 * @spec PROD-006
 */
export const sharingRequestSchema = z.strictObject({ visibility: visibilitySchema });
/** The body of a sharing request. */
export type SharingRequest = z.infer<typeof sharingRequestSchema>;

/** `PATCH /api/content/:contentId/sharing` → 200: the activity's canonical ID and its new visibility. */
export const sharingResponseSchema = z.strictObject({ contentId: z.uuid(), visibility: visibilitySchema });
/** The answer of a sharing request. */
export type SharingResponse = z.infer<typeof sharingResponseSchema>;
