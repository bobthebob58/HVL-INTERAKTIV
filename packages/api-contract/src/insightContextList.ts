/**
 * insightContextList — the answer of `GET /api/content/:contentId/insight/contexts`: the contexts the person may view
 * an activity's insight for, for the Innsikt tab's selector.
 *
 * Why: on the activity page the owner or co-author picks one of the activity's contexts, labelled with the course
 *      label a launch stored (D-106, D-087); in Canvas the launch fixes the context, so the list holds that course
 *      only (INS-007 as amended).
 * Spec: INS-007, LTI-006
 * Invariants:
 *   - PRIVACY: a context carries its key and label only, no count: a count per context beside the others would be an
 *     overview across contexts, which D-106 leaves out, and there is then nothing to suppress (INS-006).
 *   - The portal comes first when it is listed, then the courses in the order of their first placement.
 * Collaborators: ./insight.ts (`insightContextSchema`), ./routes/insightRoutes.ts,
 *   apps/server/src/insight/http/insightRoutes.ts, apps/web/src/features/insight/insightApi.ts.
 * Tests: packages/api-contract/test/insightReportSchemas.test.ts
 */
import { z } from 'zod';
import { insightContextSchema } from './insight.js';

/**
 * `GET /api/content/:contentId/insight/contexts` → 200: the portal (on the activity page) and each Canvas course the
 * activity is placed in, or the launch's course alone in Canvas.
 * @spec INS-007
 */
export const insightContextsResponseSchema = z.strictObject({ contexts: z.array(insightContextSchema) });
/** The contexts of an activity's insight. */
export type InsightContextsResponse = z.infer<typeof insightContextsResponseSchema>;
