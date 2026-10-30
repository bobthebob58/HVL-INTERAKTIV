/**
 * apiSchemaNames — the named request and answer schemas of every API area, merged into the two lists the OpenAPI
 * document builds its components from.
 *
 * Why: the document refers to schemas by name (D-077), and D-099 lets each area keep its own name list
 *      (./routes/*SchemaNames.ts). The document puts both lists into one `components.schemas` object, so a name
 *      used twice would silently replace another schema; merging refuses it instead.
 * Spec: DOC-012
 * Invariants:
 *   - A name is unique across all areas and both lists, and matches OpenAPI's `^[A-Za-z0-9._-]+$`.
 *   - One schema has at most one name per list (the zod registry keeps only one ID per schema).
 *   - Each merged list keeps the areas' order, then each area's own order, so a component never changes its place
 *     within its list. The document puts every request component before every answer component, so a new request
 *     name moves the answers' keys (JSON order only; their content is unchanged).
 * Collaborators: ./routes/*SchemaNames.ts, ./apiRouteTypes.ts, ./openApi.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, packages/api-contract/test/openApiFiles.test.ts
 */
import type { z } from 'zod';
import type { ApiSchemaNames } from './apiRouteTypes.js';
import { COLLABORATION_SCHEMA_NAMES } from './routes/collaborationSchemaNames.js';
import { CORE_SCHEMA_NAMES } from './routes/coreSchemaNames.js';
import { GRADE_BRIDGE_SCHEMA_NAMES } from './routes/gradeBridgeSchemaNames.js';
import { LEARNING_DESIGN_SCHEMA_NAMES } from './routes/learningDesignSchemaNames.js';
import { MAPPE_SCHEMA_NAMES } from './routes/mappeSchemaNames.js';
import { PATTERN_SCHEMA_NAMES } from './routes/patternSchemaNames.js';
import { STUDIO_SCHEMA_NAMES } from './routes/studioSchemaNames.js';

const COMPONENT_NAME = /^[A-Za-z0-9._-]+$/;

/**
 * Merges the name lists of several areas.
 * @param areas - The areas, in document order.
 * @returns One request list and one answer list, frozen.
 * @throws Error when a name is repeated or malformed, or one schema has two names in the same list.
 * @spec DOC-012
 */
export function mergeSchemaNames(areas: readonly ApiSchemaNames[]): ApiSchemaNames {
  const request: Record<string, z.ZodType> = {};
  const response: Record<string, z.ZodType> = {};
  const add = (target: Record<string, z.ZodType>, name: string, schema: z.ZodType) => {
    if (!COMPONENT_NAME.test(name)) throw new Error(`api-contract: "${name}" is not a valid component name`);
    if (name in request || name in response)
      throw new Error(`api-contract: the schema name ${name} is used twice`);
    if (Object.values(target).includes(schema)) throw new Error(`api-contract: ${name} names a schema twice`);
    target[name] = schema;
  };
  for (const area of areas) {
    for (const [name, schema] of Object.entries(area.request)) add(request, name, schema);
    for (const [name, schema] of Object.entries(area.response)) add(response, name, schema);
  }
  return { request: Object.freeze(request), response: Object.freeze(response) };
}

const MERGED = mergeSchemaNames([
  CORE_SCHEMA_NAMES,
  STUDIO_SCHEMA_NAMES,
  PATTERN_SCHEMA_NAMES,
  LEARNING_DESIGN_SCHEMA_NAMES,
  COLLABORATION_SCHEMA_NAMES,
  MAPPE_SCHEMA_NAMES,
  GRADE_BRIDGE_SCHEMA_NAMES,
]);

/** Named request schemas of every area, described as zod's input. */
export const REQUEST_SCHEMAS: Readonly<Record<string, z.ZodType>> = MERGED.request;

/** Named answer schemas of every area, described as zod's output. */
export const RESPONSE_SCHEMAS: Readonly<Record<string, z.ZodType>> = MERGED.response;
