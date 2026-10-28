/**
 * apiRouteTypes — the shape of one entry in the `/api` route registry, of an area's named schemas, the contract
 * version and the schema of the OpenAPI document itself.
 *
 * Why: the area registries (./routes/), the merged lists (./apiRoutes.ts, ./apiSchemaNames.ts) and the document
 *      builder (./openApi.ts) all need these types; keeping them apart from the registry tables keeps each file to
 *      one job. D-099 adds answers that are files (`mediaType`) and query parameters.
 * Spec: DOC-012, MAPPE-001
 * Invariants:
 *   - `auth` uses the four modes DOC-012 names (portal, LTI, either, admin) plus `none` for public routes.
 *   - An answer has either a JSON `schema` or a file `mediaType`, never both (D-099).
 * Collaborators: ./routes/, ./apiRoutes.ts, ./apiSchemaNames.ts, ./openApi.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, packages/api-contract/test/openApiFiles.test.ts
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

/** The media type of a Markdown file answer: UTF-8 text (MAPPE-001). */
export const MARKDOWN_MEDIA_TYPE = 'text/markdown; charset=utf-8';
/** The media type of a PDF file answer (MAPPE-004). */
export const PDF_MEDIA_TYPE = 'application/pdf';
/** Every media type a file answer may have (D-099); the server sends exactly this `Content-Type`. */
export const API_FILE_MEDIA_TYPES = [MARKDOWN_MEDIA_TYPE, PDF_MEDIA_TYPE] as const;
/** A media type of a file answer. */
export type ApiFileMediaType = (typeof API_FILE_MEDIA_TYPES)[number];

/** A documented JSON answer, or an empty one (204). */
export interface ApiJsonResponse {
  /** What the answer means, with the error codes it can carry. */
  readonly description: string;
  /** The JSON body; absent for an empty answer (204). */
  readonly schema?: z.ZodType;
  readonly mediaType?: never;
}

/**
 * A documented file answer (D-099): the body is the file itself, sent with `Content-Disposition: attachment`.
 * Several media types mean the request chooses one (for example `?format=md|pdf`).
 */
export interface ApiFileResponse {
  /** What the answer means. */
  readonly description: string;
  readonly schema?: never;
  /** The `Content-Type` of the file, or each one the request can choose. */
  readonly mediaType: ApiFileMediaType | readonly ApiFileMediaType[];
}

/** One documented answer of a route: JSON (or empty), or a file. */
export type ApiResponse = ApiJsonResponse | ApiFileResponse;

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
  /** Query parameters, one key per name; an optional key is an optional parameter (D-099). */
  readonly query?: z.ZodObject;
  /** The JSON request body. */
  readonly body?: z.ZodType;
  /** Answers by HTTP status. */
  readonly responses: Readonly<Record<number, ApiResponse>>;
}

/**
 * The named schemas of one API area: each becomes a component of the OpenAPI document, and a route may only name a
 * schema listed here (or in another area). Names are unique across all areas and both lists.
 */
export interface ApiSchemaNames {
  /** Request bodies, described as zod's input. */
  readonly request: Readonly<Record<string, z.ZodType>>;
  /** Answers, described as zod's output. */
  readonly response: Readonly<Record<string, z.ZodType>>;
}

/** `GET /api/docs` → 200: the OpenAPI 3.1 document (development only). */
export const openApiDocumentSchema = z.looseObject({
  openapi: z.string(),
  info: z.looseObject({ title: z.string(), version: z.string() }),
  paths: z.record(z.string(), z.unknown()),
});
