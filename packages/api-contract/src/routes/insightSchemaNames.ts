/**
 * insightSchemaNames — the component names of the schemas the insight routes answer with: the view, the contexts and
 * the findings.
 *
 * Why: the OpenAPI document refers to answer schemas by name (D-077); D-099 splits the name lists by area like the
 *      registry (./insightRoutes.ts), so parallel work never edits the same list.
 * Spec: DOC-012, INS-001, INS-007, INS-010
 * Invariants:
 *   - A name is unique across every area and both lists; ../apiSchemaNames.ts refuses a repeated name.
 *   - The insight routes take no request body: their query is described inline, so the request list is empty.
 * Collaborators: ./insightRoutes.ts, ../apiSchemaNames.ts, ../insightReport.ts, ../insightContextList.ts,
 *   ../insightFindings.ts.
 * Tests: packages/api-contract/test/insightRoutes.test.ts, packages/api-contract/test/openApi.test.ts
 */
import type { ApiSchemaNames } from '../apiRouteTypes.js';
import { insightContextsResponseSchema } from '../insightContextList.js';
import { insightFindingsResponseSchema } from '../insightFindings.js';
import { insightReportSchema } from '../insightReport.js';

/** The named schemas of this area: every answer schema its routes name. */
export const INSIGHT_SCHEMA_NAMES: ApiSchemaNames = {
  request: {},
  response: {
    InsightReport: insightReportSchema,
    InsightContextsResponse: insightContextsResponseSchema,
    InsightFindingsResponse: insightFindingsResponseSchema,
  },
};
