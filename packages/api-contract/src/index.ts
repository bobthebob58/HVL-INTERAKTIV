/**
 * index — the schemas of the `/api` routes, shared by the server (which validates with them) and the web app
 * (which types its requests with them), and the OpenAPI document built from them.
 *
 * Why: DOC-012 asks for zod request and response schemas and an OpenAPI document built from them (D-077). One
 *      package keeps the server and the web app on the same shapes.
 * Spec: DOC-012
 * Invariants:
 *   - One file per resource; every exported `…Schema` has an exported TypeScript type inferred from it.
 * Collaborators: ./me.ts, ./content.ts, ./findings.ts, ./publishing.ts, ./sharing.ts, ./errors.ts, ./apiRoutes.ts,
 *   ./apiRouteTypes.ts, ./openApi.ts, apps/server/src/http/api/, apps/web.
 * Tests: packages/api-contract/test/schemas.test.ts, packages/api-contract/test/openApi.test.ts
 */
export * from './apiRoutes.js';
export * from './apiRouteTypes.js';
export * from './content.js';
export * from './errors.js';
export * from './findings.js';
export * from './me.js';
export * from './openApi.js';
export * from './publishing.js';
export * from './sharing.js';
