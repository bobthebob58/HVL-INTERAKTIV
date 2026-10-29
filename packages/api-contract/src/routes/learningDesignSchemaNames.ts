/**
 * learningDesignSchemaNames — the component names of the schemas that learningDesign routes use.
 *
 * Why: the OpenAPI document refers to request and answer schemas by name (D-077); D-099 splits the name lists by
 *      area like the registry (./learningDesignRoutes.ts), so parallel work never edits the same list.
 * Spec: DOC-012
 * Invariants:
 *   - A name is unique across every area and both lists; ../apiSchemaNames.ts refuses a repeated name.
 * Collaborators: ./learningDesignRoutes.ts, ../apiSchemaNames.ts, ../learningDesign.ts, ../planner.ts.
 * Tests: packages/api-contract/test/openApi.test.ts
 */
import type { ApiSchemaNames } from '../apiRouteTypes.js';
import * as learningDesign from '../learningDesign.js';
import * as planner from '../planner.js';

/** The named schemas of this area: every request and answer schema its routes name. */
export const LEARNING_DESIGN_SCHEMA_NAMES: ApiSchemaNames = {
  request: {
    LearningDesignUpdate: learningDesign.learningDesignUpdateSchema,
    LearningOutcomeInput: learningDesign.learningOutcomeSchema,
  },
  response: {
    LearningDesign: learningDesign.learningDesignSchema,
    LearningOutcome: learningDesign.learningOutcomeSchema,
    CourseCodeSuggestions: learningDesign.courseCodeSuggestionsSchema,
    CourseOutcomes: learningDesign.courseOutcomesSchema,
    Planner: planner.plannerSchema,
    PlannerRow: planner.plannerRowSchema,
    PlannerCell: planner.plannerCellSchema,
    PlannerActivity: planner.plannerActivitySchema,
    PlannerGap: planner.plannerGapSchema,
    PlannerUntagged: planner.plannerUntaggedSchema,
  },
};
