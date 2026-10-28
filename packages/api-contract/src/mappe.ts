/**
 * mappe — the shapes of the pedagogisk mappe: the activities an author can pick, the word-count preview and the
 * export request, whose answer is a Markdown or PDF file.
 *
 * Why: MAPPE-001 lets an author pick activities and export a portfolio draft as Markdown (to edit) and PDF (to
 *      submit). D-094 renders it from the criteria set's template with limits per set; the page announces the Del 1
 *      word count from a preview. The export is a file (D-099 `mediaType`) and is never stored (MAPPE-003).
 * Spec: MAPPE-001, MAPPE-002, MAPPE-003, MAPPE-004
 * Invariants:
 *   - A request names 1 to 50 distinct activities; the server answers only for activities the author owns or
 *     co-authors.
 *   - PRIVACY: nothing here carries learner data; aggregates in the file follow the minimum group size (D-095).
 *   - The criteria set defaults to `hvl-merittering-2025` (MAPPE-002).
 * Collaborators: ./me.ts, ./content.ts, ./learningDesign.ts, ./studio.ts, ./apiRouteTypes.ts (media types),
 *   apps/server (W6), apps/web.
 * Tests: packages/api-contract/test/mappeSchemas.test.ts
 */
import { z } from 'zod';
import { contentStatusSchema } from './content.js';
import { courseCodeSchema } from './learningDesign.js';
import { localeSchema } from './me.js';
import { phaseKeySchema } from './studio.js';

/** The most activities one portfolio may include. */
export const MAPPE_MAX_ACTIVITIES = 50;
/** The criteria set used when a request names none (MAPPE-002). */
export const DEFAULT_CRITERIA_SET = 'hvl-merittering-2025';

/** A criteria set's ID, the key in `content/mappe/criteria.{nn,nb,en}.yaml`. */
export const criteriaSetIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,63}$/)
  .describe('A criteria set ID, e.g. `hvl-merittering-2025`.');
/** A criteria set ID. */
export type CriteriaSetId = z.infer<typeof criteriaSetIdSchema>;

/** An activity the author can pick, with what the page filters by: course, phase and date (MAPPE-001). */
export const mappeActivitySchema = z.strictObject({
  contentId: z.uuid(),
  title: z.string(),
  mainLibrary: z.string(),
  status: contentStatusSchema,
  /** The activity's own language tag (UD-010). */
  language: z.string().optional(),
  phase: phaseKeySchema.optional(),
  courseCode: courseCodeSchema.optional(),
  updatedAt: z.iso.datetime(),
});
/** An activity the author can pick. */
export type MappeActivity = z.infer<typeof mappeActivitySchema>;

/** The author's own and co-authored activities to pick from, newest change first. */
export const mappeActivityListSchema = z.strictObject({ items: z.array(mappeActivitySchema) });
/** The activities to pick from. */
export type MappeActivityList = z.infer<typeof mappeActivityListSchema>;

/**
 * `POST /api/mappe/preview` and `POST /api/mappe/export` body: the chosen activities, the criteria set and the
 * portfolio's language.
 * @spec MAPPE-001
 */
export const mappeRequestSchema = z.strictObject({
  contentIds: z
    .array(z.uuid())
    .min(1)
    .max(MAPPE_MAX_ACTIVITIES)
    .refine((ids) => new Set(ids).size === ids.length, 'An activity is named twice.')
    .describe('1 to 50 distinct activity IDs, in the order the portfolio lists them.'),
  criteriaSet: criteriaSetIdSchema.optional(),
  locale: localeSchema,
});
/** The body of a portfolio preview or export. */
export type MappeRequest = z.infer<typeof mappeRequestSchema>;

/** `POST /api/mappe/export?format=md|pdf`: which file to make. */
export const mappeExportQuerySchema = z.strictObject({
  format: z
    .enum(['md', 'pdf'])
    .describe('`md` for Markdown (always works) or `pdf` (needs the server’s browser).'),
});
/** The query of a portfolio export. */
export type MappeExportQuery = z.infer<typeof mappeExportQuerySchema>;

/**
 * `POST /api/mappe/preview` → 200: the Del 1 word count and the attachment count against the criteria set's limits
 * (D-094); the page announces it politely.
 * @spec MAPPE-002
 */
export const mappePreviewSchema = z.strictObject({
  criteriaSet: criteriaSetIdSchema,
  /** Words in Del 1, without the reader's guide and the references. */
  words: z.int().min(0),
  wordLimit: z.int().min(1),
  attachments: z.int().min(0),
  attachmentLimit: z.int().min(1),
  /** True when `words` or `attachments` is above its limit. */
  overLimit: z.boolean(),
});
/** The answer of a portfolio preview. */
export type MappePreview = z.infer<typeof mappePreviewSchema>;
