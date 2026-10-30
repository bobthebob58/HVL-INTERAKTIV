/**
 * index — the schemas of the `/api` routes, shared by the server (which validates with them) and the web app
 * (which types its requests with them), and the OpenAPI document built from them.
 *
 * Why: DOC-012 asks for zod request and response schemas and an OpenAPI document built from them (D-077). One
 *      package keeps the server and the web app on the same shapes.
 * Spec: DOC-012
 * Invariants:
 *   - One file per resource or area; every exported `…Schema` has an exported TypeScript type inferred from it
 *     (`insightCellSchema` is a function that makes cell schemas, typed by the cells it makes).
 *   - The route registries and their schema-name lists live in ./routes/, one pair per area (D-099); they are
 *     exported merged (`API_ROUTES`, `REQUEST_SCHEMAS`, `RESPONSE_SCHEMAS`), not one by one.
 * Collaborators: ./me.ts, ./content.ts, ./findings.ts, ./publishing.ts, ./sharing.ts, ./errors.ts, ./studio.ts,
 *   ./guideNodes.ts, ./patterns.ts, ./learnerInfo.ts, ./learningDesign.ts, ./planner.ts, ./collaboration.ts,
 *   ./sourceAttribution.ts, ./mappe.ts, ./learningDesignErrors.ts, ./xapi.ts, ./xapiResponseCaps.ts, ./gradeSync.ts,
 *   ./insight.ts, ./apiRoutes.ts, ./apiRouteTypes.ts, ./apiSchemaNames.ts, ./openApi.ts, apps/server/src/http/api/,
 *   apps/web.
 * Tests: packages/api-contract/test/
 */
export * from './apiRoutes.js';
export * from './apiRouteTypes.js';
export * from './collaboration.js';
export * from './content.js';
export * from './errors.js';
export * from './findings.js';
export * from './gradeSync.js';
export * from './guideNodes.js';
export * from './insight.js';
export * from './learnerInfo.js';
export * from './learningDesign.js';
export * from './learningDesignErrors.js';
export * from './mappe.js';
export * from './me.js';
export * from './openApi.js';
export * from './patterns.js';
export * from './planner.js';
export * from './publishing.js';
export * from './sharing.js';
export * from './sourceAttribution.js';
export * from './studio.js';
export * from './xapi.js';
export * from './xapiResponseCaps.js';
