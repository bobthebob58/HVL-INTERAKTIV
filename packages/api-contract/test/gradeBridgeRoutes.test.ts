/**
 * Tests the grade-bridge route registry: it builds an OpenAPI document whose references resolve, it documents the
 * answers D-115 and D-104 fix, and it is kept out of `API_ROUTES` until the server mounts the routes.
 *
 * Spec: DOC-012, LTI-011, LTI-012
 */
import { describe, expect, it } from 'vitest';
import { GRADE_BRIDGE_ROUTES } from '../src/routes/gradeBridgeRoutes.js';
import {
  API_ROUTES,
  buildOpenApiDocument,
  REQUEST_SCHEMAS,
  RESPONSE_SCHEMAS,
  type ApiRoute,
} from '../src/index.js';

type Operation = { security: Record<string, string[]>[]; responses: Record<string, { content?: unknown }> };

const document = buildOpenApiDocument(GRADE_BRIDGE_ROUTES);
const operation = (method: string, path: string) =>
  (document.paths[path] as Record<string, Operation> | undefined)?.[method] as Operation;
const refsIn = (node: unknown): string[] =>
  typeof node !== 'object' || node === null
    ? []
    : Object.entries(node).flatMap(([key, value]) =>
        key === '$ref' && typeof value === 'string' ? [value] : refsIn(value),
      );

describe('[DOC-012] grade-bridge routes', () => {
  it('[LTI-011] the xAPI batch is accepted with 202 and no body, and refused whole with 400, 403, 413 or 429', () => {
    // Act
    const xapi = operation('post', '/api/h5p/xapi');
    // Assert
    expect(Object.keys(xapi.responses).sort()).toEqual(['202', '400', '401', '403', '413', '429']);
    expect(xapi.responses['202']?.content).toBeUndefined();
    expect(JSON.stringify(xapi.responses['429'])).toContain('Retry-After');
    expect(xapi.security).toEqual([{ portalSession: [], csrfToken: [] }, { ltik: [] }]);
  });

  it('[LTI-012] authors read the grade sync and retry a placement, from the portal or from Canvas', () => {
    // Act
    const status = operation('get', '/api/content/{contentId}/grade-sync');
    const retry = operation('post', '/api/content/{contentId}/grade-sync/retry');
    // Assert
    expect(Object.keys(status.responses).sort()).toEqual(['200', '401', '403', '404']);
    expect(Object.keys(retry.responses).sort()).toEqual(['200', '400', '401', '403', '404']);
    expect(status.security).toEqual([{ portalSession: [] }, { ltik: [] }]);
    expect(retry.security).toEqual([{ portalSession: [], csrfToken: [] }, { ltik: [] }]);
  });

  it('[DOC-012] every reference resolves, and every schema the routes name is a named component', () => {
    // Act
    const components = (document.components as { schemas: Record<string, unknown> }).schemas;
    const refs = refsIn(document);
    // Assert
    expect(refs.length).toBeGreaterThanOrEqual(GRADE_BRIDGE_ROUTES.length);
    expect(refs.filter((ref) => !(ref.replace('#/components/schemas/', '') in components))).toEqual([]);
    for (const name of ['XapiBatch', 'XapiStatementItem', 'GradeSyncRetryRequest'])
      expect(REQUEST_SCHEMAS).toHaveProperty(name);
    for (const name of ['GradeSyncStatusResponse', 'GradeSyncRetryResponse'])
      expect(RESPONSE_SCHEMAS).toHaveProperty(name);
  });

  it('[DOC-012] stays out of API_ROUTES until mounted, with operation IDs and paths that no other area uses', () => {
    // Arrange
    const registered: readonly ApiRoute[] = API_ROUTES;
    const key = (route: ApiRoute) => `${route.method} ${route.path}`;
    // Act
    const ids = new Set(registered.map((route) => route.operationId));
    const pairs = new Set(registered.map(key));
    // Assert
    for (const route of GRADE_BRIDGE_ROUTES) {
      expect(ids.has(route.operationId), route.operationId).toBe(false);
      expect(pairs.has(key(route)), key(route)).toBe(false);
      expect(Object.keys(route.responses)).toContain('401');
    }
  });
});
