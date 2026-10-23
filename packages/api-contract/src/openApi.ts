/**
 * openApi — builds the OpenAPI 3.1 document of the `/api` routes from the route registry and the zod schemas.
 *
 * Why: DOC-012 asks for an OpenAPI document generated from the request and response schemas; D-077 builds it with
 *      zod 4's own `z.toJSONSchema` instead of adding an OpenAPI library. Named components keep the document readable
 *      for reviewers and the web app.
 * Spec: DOC-012
 * Invariants:
 *   - Pure: the same registry gives the same document; nothing is registered globally.
 *   - Request bodies are described as zod's input, answers as its output; every schema a route names must be listed
 *     here, else building throws (a test builds the document).
 *   - The security schemes name the server's real cookie and CSRF header; a server test compares them.
 * Collaborators: ./apiRoutes.ts, ./apiRouteTypes.ts, apps/server/src/http/api/apiDocsRoutes.ts.
 * Tests: packages/api-contract/test/openApi.test.ts, apps/server/test/http/api/apiDocs.int.test.ts
 */
import { z } from 'zod';
import { API_ROUTES } from './apiRoutes.js';
import { API_CONTRACT_VERSION, openApiDocumentSchema, type ApiRoute } from './apiRouteTypes.js';
import { contentDetailSchema, contentListSchema, contentSummarySchema } from './content.js';
import { errorBodySchema, publishBlockedBodySchema, publishConflictBodySchema } from './errors.js';
import {
  acknowledgementSchema,
  findingsResponseSchema,
  findingWithAcknowledgementSchema,
} from './findings.js';
import { dismissedNoticeSchema, meSchema, noticeDismissalRequestSchema } from './me.js';
import * as publishing from './publishing.js';
import { sharingRequestSchema, sharingResponseSchema } from './sharing.js';

/** The portal session cookie (apps/server/src/auth/session/sessionCookies.ts, AUTH-003). */
export const PORTAL_SESSION_COOKIE = '__Host-hvli_sid';
/** The header that carries the session's CSRF token (apps/server/src/auth/session/csrfToken.ts, D-057). */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** Named request schemas, described as zod's input. */
export const REQUEST_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  NoticeDismissalRequest: noticeDismissalRequestSchema,
  AcknowledgementInput: publishing.acknowledgementInputSchema,
  PublishRequest: publishing.publishRequestSchema,
  UnpublishRequest: publishing.unpublishRequestSchema,
  SharingRequest: sharingRequestSchema,
};

/** Named answer schemas, described as zod's output. */
export const RESPONSE_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  Me: meSchema,
  DismissedNotice: dismissedNoticeSchema,
  ContentSummary: contentSummarySchema,
  ContentList: contentListSchema,
  ContentDetail: contentDetailSchema,
  Acknowledgement: acknowledgementSchema,
  FindingWithAcknowledgement: findingWithAcknowledgementSchema,
  FindingsResponse: findingsResponseSchema,
  PublishResponse: publishing.publishResponseSchema,
  UnpublishResponse: publishing.unpublishResponseSchema,
  SharingResponse: sharingResponseSchema,
  ErrorBody: errorBodySchema,
  PublishBlockedBody: publishBlockedBodySchema,
  PublishConflictBody: publishConflictBodySchema,
  OpenApiDocument: openApiDocumentSchema,
};

/** An OpenAPI 3.1 document as plain JSON. */
export type OpenApiDocument = z.infer<typeof openApiDocumentSchema>;

const REF = '#/components/schemas/';
const UNSAFE = new Set(['put', 'post', 'patch', 'delete']);

/** JSON Schemas of named schemas, without `$schema` and `$id` (the document sets the dialect once). */
function components(named: Readonly<Record<string, z.ZodType>>, io: 'input' | 'output') {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(named)) registry.add(schema, { id });
  const { schemas } = z.toJSONSchema(registry, { io, target: 'draft-2020-12', uri: (id) => `${REF}${id}` });
  return Object.fromEntries(
    Object.entries(schemas).map(([id, { $schema: _s, $id: _i, ...schema }]) => [id, schema]),
  );
}

const refTo = (named: Readonly<Record<string, z.ZodType>>, schema: z.ZodType, where: string) => {
  const name = Object.entries(named).find(([, candidate]) => candidate === schema)?.[0];
  if (!name) throw new Error(`${where}: the schema has no name in openApi.ts`);
  return { $ref: `${REF}${name}` };
};

/** Who may call a route, as OpenAPI security requirements (any one of them suffices). */
function securityOf(route: ApiRoute): Record<string, string[]>[] {
  const portal: Record<string, string[]> = UNSAFE.has(route.method)
    ? { portalSession: [], csrfToken: [] }
    : { portalSession: [] };
  switch (route.auth) {
    case 'none':
      return [];
    case 'lti':
      return [{ ltik: [] }];
    case 'portal':
    case 'admin':
      return [portal];
    default:
      return [portal, { ltik: [] }];
  }
}

function operationOf(route: ApiRoute) {
  const where = `${route.method.toUpperCase()} ${route.path}`;
  const json = (schema: z.ZodType, named: Readonly<Record<string, z.ZodType>>) => ({
    content: { 'application/json': { schema: refTo(named, schema, where) } },
  });
  const parameters = Object.entries(route.params?.shape ?? {}).map(([name, schema]) => {
    const { $schema: _dialect, ...json } = z.toJSONSchema(schema as z.ZodType, { target: 'draft-2020-12' });
    return { name, in: 'path', required: true, schema: json };
  });
  const responses = Object.fromEntries(
    Object.entries(route.responses).map(([status, { description, schema }]) => [
      status,
      { description, ...(schema ? json(schema, RESPONSE_SCHEMAS) : {}) },
    ]),
  );
  return {
    operationId: route.operationId,
    summary: route.summary,
    'x-hvl-auth': route.auth,
    security: securityOf(route),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(route.body ? { requestBody: { required: true, ...json(route.body, REQUEST_SCHEMAS) } } : {}),
    responses,
  };
}

/**
 * Builds the OpenAPI 3.1 document of the `/api` routes.
 * @param routes - The route registry; the real one by default.
 * @returns The document as plain JSON; paths include the `/api` prefix.
 * @throws Error when a route names a schema that is not listed in `REQUEST_SCHEMAS` or `RESPONSE_SCHEMAS`.
 * @spec DOC-012
 */
export function buildOpenApiDocument(routes: readonly ApiRoute[] = API_ROUTES): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    const path = `/api${route.path.replace(/:(\w+)/g, '{$1}')}`;
    (paths[path] ??= {})[route.method] = operationOf(route);
  }
  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'HVL Interaktiv API',
      version: String(API_CONTRACT_VERSION),
      description:
        'The JSON API of HVL Interaktiv. Errors share one shape (ErrorBody) with a translated message. Portal ' +
        `requests send the session cookie and, on unsafe methods, the \`${CSRF_HEADER_NAME}\` header with the ` +
        'token from `GET /auth/session`; LTI requests send the ltik as `Authorization: Bearer`.',
    },
    paths,
    components: {
      schemas: { ...components(REQUEST_SCHEMAS, 'input'), ...components(RESPONSE_SCHEMAS, 'output') },
      securitySchemes: {
        portalSession: { type: 'apiKey', in: 'cookie', name: PORTAL_SESSION_COOKIE },
        csrfToken: { type: 'apiKey', in: 'header', name: CSRF_HEADER_NAME },
        ltik: { type: 'http', scheme: 'bearer', description: 'The ltik of a Canvas launch (LTI-003).' },
      },
    },
  };
}
