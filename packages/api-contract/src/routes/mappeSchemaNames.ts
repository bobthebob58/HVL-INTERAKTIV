/**
 * mappeSchemaNames — the component names of the schemas that mappe routes (W6) use.
 *
 * Why: the OpenAPI document refers to request and answer schemas by name (D-077); D-099 splits the name lists by
 *      area like the registry (./mappeRoutes.ts), so parallel work never edits the same list.
 * Spec: DOC-012
 * Invariants:
 *   - A name is unique across every area and both lists; ../apiSchemaNames.ts refuses a repeated name.
 * Collaborators: ./mappeRoutes.ts, ../apiSchemaNames.ts, ../mappe.ts.
 * Tests: packages/api-contract/test/openApi.test.ts
 */
import type { ApiSchemaNames } from '../apiRouteTypes.js';
import * as mappe from '../mappe.js';

/** The named schemas of this area; workstreams add the ones their routes use (W6). */
export const MAPPE_SCHEMA_NAMES: ApiSchemaNames = {
  request: { MappeRequest: mappe.mappeRequestSchema },
  response: {
    MappeActivity: mappe.mappeActivitySchema,
    MappeActivityList: mappe.mappeActivityListSchema,
    MappePreview: mappe.mappePreviewSchema,
  },
};
