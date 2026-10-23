/**
 * content — the shapes of `GET /api/content` and `GET /api/content/:contentId`: an author's activities and what the
 * person may do with one.
 *
 * Why: the web app's start page lists the activities a person owns or co-authors, and the activity page needs to
 *      know whether to offer editing and publishing (PROD-003, H5P-006). The server decides; the client only shows.
 * Spec: PROD-003, PROD-006, H5P-006, DOC-012
 * Invariants:
 *   - Dates are ISO 8601 strings in UTC (`2026-10-23T12:00:00.000Z`); `publishedAt` is null for a draft.
 *   - `mainLibrary` is the content type's machine name, e.g. `H5P.MultiChoice`.
 *   - A summary never names another person: no owner name, e-mail address or user ID.
 * Collaborators: ./apiRoutes.ts, apps/server/src/http/api/contentListRoutes.ts, apps/web.
 * Tests: packages/api-contract/test/schemas.test.ts
 */
import { z } from 'zod';

/** Whether learners may see an activity at all (`PROD-004`). */
export const contentStatusSchema = z.enum(['draft', 'published']);
/** Draft or published. */
export type ContentStatus = z.infer<typeof contentStatusSchema>;

/** Who may open an activity outside Canvas (`PROD-006`): only me and co-authors, all of HVL, any Feide user. */
export const visibilitySchema = z.enum(['private', 'organisation', 'feide']);
/** A visibility level. */
export type Visibility = z.infer<typeof visibilitySchema>;

/** The person's relation to an activity they author. */
export const contentRoleSchema = z.enum(['owner', 'coAuthor']);
/** Owner or co-author. */
export type ContentRole = z.infer<typeof contentRoleSchema>;

/** One activity in a list. */
export const contentSummarySchema = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  mainLibrary: z.string(),
  status: contentStatusSchema,
  visibility: visibilitySchema,
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  role: contentRoleSchema,
});
/** One activity in a list. */
export type ContentSummary = z.infer<typeof contentSummarySchema>;

/** `GET /api/content` → 200: the person's own and co-authored activities, newest change first. */
export const contentListSchema = z.strictObject({ items: z.array(contentSummarySchema) });
/** The answer of `GET /api/content`. */
export type ContentList = z.infer<typeof contentListSchema>;

/**
 * `GET /api/content/:contentId` → 200: one activity the person may view, and what they may do with it. `role` is
 * null when the person neither owns nor co-authors it (an admin, or a colleague viewing a shared activity).
 * @spec H5P-006
 */
export const contentDetailSchema = contentSummarySchema.extend({
  role: contentRoleSchema.nullable(),
  /** H5P-006 Edit: open the editor and save. */
  mayEdit: z.boolean(),
  /** Check, publish and unpublish (PROD-003); the same people who may edit. */
  mayPublish: z.boolean(),
});
/** The answer of `GET /api/content/:contentId`. */
export type ContentDetail = z.infer<typeof contentDetailSchema>;
