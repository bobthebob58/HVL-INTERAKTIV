/**
 * apiRouteTypes — the shape of one entry in the `/api` route registry, the contract version and the schema of the
 * OpenAPI document itself.
 *
 * Why: the registry (./apiRoutes.ts) and the document builder (./openApi.ts) both need these types; keeping them apart
 *      from the long registry table keeps each file to one job.
 * Spec: DOC-012
 * Invariants:
 *   - `auth` uses the four modes DOC-012 names (portal, LTI, either, admin) plus `none` for the document itself.
 * Collaborators: ./apiRoutes.ts, ./openApi.ts.
 * Tests: packages/api-contract/test/openApi.test.ts
 */
import { z } from 'zod';

/** The version of this contract; it changes when a shape changes incompatibly. */
export const API_CONTRACT_VERSION = 1;

/**
 * How a route authenticates (DOC-012): `either` is a portal session (with the CSRF token on unsafe methods) or an
 * ltik as `Authorization: Bearer`; `none` needs nobody signed in.
 */
export type ApiAuthMode = 'none' | 'portal' | 'lti' | 'either' | 'admin';

/** An HTTP method the API uses. */
export type ApiMethod = 'get' | 'put' | 'post' | 'patch' | 'delete';

/** One documented answer of a route. */
export interface ApiResponse {
  /** What the answer means, with the error codes it can carry. */
  readonly description: string;
  /** The JSON body; absent for an empty answer (204). */
  readonly schema?: z.ZodType;
}

/** One route under `/api`. */
export interface ApiRoute {
  /** Unique name of the operation, e.g. `publishContent`. */
  readonly operationId: string;
  readonly method: ApiMethod;
  /** Path below `/api`, in Express form, e.g. `/content/:contentId/publish`. */
  readonly path: string;
  readonly auth: ApiAuthMode;
  readonly summary: string;
  /** Path parameters, one key per `:name`. */
  readonly params?: z.ZodObject;
  /** The JSON request body. */
  readonly body?: z.ZodType;
  /** Answers by HTTP status. */
  readonly responses: Readonly<Record<number, ApiResponse>>;
}

/** `GET /api/docs` → 200: the OpenAPI 3.1 document (development only). */
export const openApiDocumentSchema = z.looseObject({
  openapi: z.string(),
  info: z.looseObject({ title: z.string(), version: z.string() }),
  paths: z.record(z.string(), z.unknown()),
});
