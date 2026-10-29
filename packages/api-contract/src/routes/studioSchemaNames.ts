/**
 * studioSchemaNames — the component names of the schemas that studio routes use.
 *
 * Why: the OpenAPI document refers to request and answer schemas by name (D-077); D-099 splits the name lists by
 *      area like the registry (./studioRoutes.ts), so parallel work never edits the same list.
 * Spec: DOC-012
 * Invariants:
 *   - A name is unique across every area and both lists; ../apiSchemaNames.ts refuses a repeated name.
 * Collaborators: ./studioRoutes.ts, ../apiSchemaNames.ts, ../studio.ts, ../guideNodes.ts.
 * Tests: packages/api-contract/test/openApi.test.ts
 */
import type { ApiSchemaNames } from '../apiRouteTypes.js';
import * as studio from '../studio.js';
import * as guide from '../guideNodes.js';

/** The named schemas of this area: every request and answer schema its routes name. */
export const STUDIO_SCHEMA_NAMES: ApiSchemaNames = {
  request: {},
  response: {
    StudioOverview: studio.studioOverviewSchema,
    StudioAnchor: studio.studioAnchorSchema,
    Phase: studio.phaseSchema,
    PatternSummary: studio.patternSummarySchema,
    PatternDetail: studio.patternDetailSchema,
    Reference: studio.referenceSchema,
    Guide: studio.guideSchema,
    GuideBlockNode: guide.guideBlockNodeSchema,
    GuideProseNode: guide.guideProseNodeSchema,
    GuideInlineNode: guide.guideInlineNodeSchema,
    GuideLinkContentNode: guide.guideLinkContentNodeSchema,
  },
};
