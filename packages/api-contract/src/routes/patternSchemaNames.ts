/**
 * patternSchemaNames — the component names of the schemas that pattern routes (W2) use.
 *
 * Why: the OpenAPI document refers to request and answer schemas by name (D-077); D-099 splits the name lists by
 *      area like the registry (./patternRoutes.ts), so parallel work never edits the same list.
 * Spec: DOC-012
 * Invariants:
 *   - A name is unique across every area and both lists; ../apiSchemaNames.ts refuses a repeated name.
 * Collaborators: ./patternRoutes.ts, ../apiSchemaNames.ts, ../patterns.ts.
 * Tests: packages/api-contract/test/openApi.test.ts
 */
import type { ApiSchemaNames } from '../apiRouteTypes.js';
import { patternActivityRequestSchema, patternActivityResponseSchema } from '../patterns.js';

/** The named schemas of this area; workstreams add the ones their routes use (W2). */
export const PATTERN_SCHEMA_NAMES: ApiSchemaNames = {
  request: { PatternActivityRequest: patternActivityRequestSchema },
  response: { PatternActivityResponse: patternActivityResponseSchema },
};
