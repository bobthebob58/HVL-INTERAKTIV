/**
 * sourceAttribution — where a copied activity came from: the source activity and its author, for the activity
 * detail.
 *
 * Why: PROD-007 keeps a duplicate's link to its source and the original author's attribution. D-092 stores the
 *      source's ID and the source author's user ID on the copy and reads the name when the copy is shown, so a later
 *      change of name shows.
 * Spec: PROD-007
 * Invariants:
 *   - PRIVACY: the only other person an activity detail may name is the source author of a copy (staff names are
 *     visible to colleagues, D-090, D-091); never an e-mail address, a Feide ID or a user ID.
 *   - PRIVACY: the activity detail is also read by learners and viewers (`auth: 'either'`, the **Spel** tab and
 *     Canvas), and /personvern only tells staff that colleagues see their names. The server therefore fills these
 *     fields only when the reader may Edit the copy (`mayEdit`); everyone else gets none of them.
 *   - Every field is optional: an original has none, and the server leaves out what it may not show or no longer
 *     knows (a deleted source, a deleted account, a source the person may not view).
 *   - A leaf module (imports only zod), so ./content.ts can use it without an import cycle.
 * Collaborators: ./content.ts (activity detail), ./collaboration.ts, apps/server (duplicate, W4), apps/web.
 * Tests: packages/api-contract/test/collaborationSchemas.test.ts
 */
import { z } from 'zod';

/**
 * Where a copy came from (D-092); spread into the activity detail, and filled only for people who may edit the copy.
 * @spec PROD-007
 */
export const sourceAttributionSchema = z.strictObject({
  /** The activity this one was copied from, while it exists. */
  sourceContentId: z.uuid().optional(),
  /** The source's title, only when the person may view the source. */
  sourceTitle: z.string().optional(),
  /** The source author's display name, read when shown; absent when unknown. */
  sourceAuthorName: z.string().optional(),
});
/** Where a copy came from. */
export type SourceAttribution = z.infer<typeof sourceAttributionSchema>;
