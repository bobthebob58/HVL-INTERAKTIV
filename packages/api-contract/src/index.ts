/**
 * index — the schemas of the `/api` routes, shared by the server (which validates with them) and the web app
 * (which types its requests with them).
 *
 * Why: DOC-012 asks for zod request and response schemas and an OpenAPI document built from them (D-077). One
 *      package keeps the server and the web app on the same shapes.
 * Spec: DOC-012
 * Tests: packages/api-contract/test/
 */

/** The version of this contract; it changes when a shape changes incompatibly. */
export const API_CONTRACT_VERSION = 1;
