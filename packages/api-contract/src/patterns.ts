/**
 * patterns — the shapes of `POST /api/patterns/:patternId/activities`, which creates a draft activity from a pattern
 * in one server request.
 *
 * Why: PROD-001 opens the editor pre-filled with a pedagogically sound skeleton. D-085 builds the skeleton on the
 *      server, saves it through the editor's save path and writes the learning-design metadata in the same request,
 *      so neither the skeleton nor the metadata travels through the browser.
 * Spec: PROD-001, PED-010, PED-030
 * Invariants:
 *   - `language` is the new activity's language (the page's by default, chosen by the web app).
 *   - `phase` must be one of the pattern's phases and `contentType` one of its content types; a pattern with two
 *     content types needs `contentType`. Otherwise the server answers 400 `hvl:pattern-choice-invalid`.
 *   - The answer names only the new activity; the web app opens `/aktivitet/:id` on the Rediger tab.
 * Collaborators: ./studio.ts, ./learningDesign.ts, ./me.ts, apps/server/src/learningDesign/http/patternRoutes.ts,
 *   apps/web.
 * Tests: packages/api-contract/test/learningDesignSchemas.test.ts
 */
import { z } from 'zod';
import { courseCodeSchema } from './learningDesign.js';
import { localeSchema } from './me.js';
import { authorableContentTypeSchema, patternIdSchema, phaseKeySchema } from './studio.js';

/** Path parameters of a route about one pattern: `:patternId`. */
export const patternParamsSchema = z.strictObject({ patternId: patternIdSchema });
/** The path parameters of a route about one pattern. */
export type PatternParams = z.infer<typeof patternParamsSchema>;

/**
 * `POST /api/patterns/:patternId/activities` body (D-085).
 * @spec PROD-001
 */
export const patternActivityRequestSchema = z.strictObject({
  language: localeSchema.describe('The language of the new activity and of the pattern texts it gets.'),
  phase: phaseKeySchema.optional().describe('One of the pattern’s phases; its first phase when left out.'),
  courseCode: courseCodeSchema.optional(),
  contentType: authorableContentTypeSchema
    .optional()
    .describe('One of the pattern’s content types; required when it has two.'),
});
/** The body of a create-from-pattern request. */
export type PatternActivityRequest = z.infer<typeof patternActivityRequestSchema>;

/** `POST /api/patterns/:patternId/activities` → 201: the new draft activity. */
export const patternActivityResponseSchema = z.strictObject({ contentId: z.uuid() });
/** The answer of a create-from-pattern request. */
export type PatternActivityResponse = z.infer<typeof patternActivityResponseSchema>;
