/**
 * gradeBridgeSchemaNames — the component names of the schemas the grade-bridge routes use: the xAPI batch, the
 * grade-sync status and its retry.
 *
 * Why: the OpenAPI document refers to request and answer schemas by name (D-077); D-099 splits the name lists by
 *      area like the registry (./gradeBridgeRoutes.ts), so parallel work never edits the same list.
 * Spec: DOC-012, LTI-011, LTI-012
 * Invariants:
 *   - A name is unique across every area and both lists; ../apiSchemaNames.ts refuses a repeated name.
 *   - The names are merged now, so the document describes the shapes before the routes are mounted (as S5's areas
 *     did); the routes join `API_ROUTES` with the server change that mounts them.
 * Collaborators: ./gradeBridgeRoutes.ts, ../apiSchemaNames.ts, ../xapi.ts, ../gradeSync.ts.
 * Tests: packages/api-contract/test/gradeBridgeRoutes.test.ts, packages/api-contract/test/openApi.test.ts
 */
import type { ApiSchemaNames } from '../apiRouteTypes.js';
import * as gradeSync from '../gradeSync.js';
import * as xapi from '../xapi.js';

/** The named schemas of this area: every request and answer schema its routes name. */
export const GRADE_BRIDGE_SCHEMA_NAMES: ApiSchemaNames = {
  request: {
    XapiBatch: xapi.xapiBatchSchema,
    XapiStatementItem: xapi.xapiStatementItemSchema,
    GradeSyncRetryRequest: gradeSync.gradeSyncRetryRequestSchema,
  },
  response: {
    GradeSyncPlacement: gradeSync.gradeSyncPlacementSchema,
    GradeSyncStatusResponse: gradeSync.gradeSyncStatusResponseSchema,
    GradeSyncRetryResponse: gradeSync.gradeSyncRetryResponseSchema,
  },
};
