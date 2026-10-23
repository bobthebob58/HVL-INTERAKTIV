/**
 * Tests that the OpenAPI document describes every registered route, with resolvable schemas and the right security.
 *
 * Spec: DOC-012
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { API_ROUTES, buildOpenApiDocument, type ApiRoute } from '../src/index.js';

type Operation = {
  operationId: string;
  'x-hvl-auth': string;
  security: Record<string, string[]>[];
  parameters?: { name: string; in: string }[];
  responses: Record<string, unknown>;
};

const document = buildOpenApiDocument();
const operationOf = (route: ApiRoute): Operation | undefined =>
  (document.paths[`/api${route.path.replace(/:(\w+)/g, '{$1}')}`] as Record<string, Operation> | undefined)?.[
    route.method
  ];

const refsIn = (node: unknown): string[] =>
  typeof node !== 'object' || node === null
    ? []
    : Object.entries(node).flatMap(([key, value]) =>
        key === '$ref' && typeof value === 'string' ? [value] : refsIn(value),
      );

describe('[DOC-012] OpenAPI document', () => {
  it('[DOC-012] lists every registered route with its operation, auth mode, parameters and answers', () => {
    // Act
    const missing = API_ROUTES.filter((route) => !operationOf(route));
    // Assert
    expect(document.openapi).toBe('3.1.0');
    expect(missing).toEqual([]);
    for (const route of API_ROUTES) {
      const operation = operationOf(route) as Operation;
      expect(operation.operationId).toBe(route.operationId);
      expect(operation['x-hvl-auth']).toBe(route.auth);
      expect(Object.keys(operation.responses).sort()).toEqual(Object.keys(route.responses).sort());
      const names = [...route.path.matchAll(/:(\w+)/g)].map((m) => m[1]);
      expect(operation.parameters?.map((p) => p.name) ?? [], route.path).toEqual(names);
    }
  });

  it('[DOC-012] every schema reference resolves to a component', () => {
    // Act
    const components = (document.components as { schemas: Record<string, unknown> }).schemas;
    const unresolved = refsIn(document).filter(
      (ref) => !(ref.replace('#/components/schemas/', '') in components),
    );
    // Assert
    expect(refsIn(document).length).toBeGreaterThan(API_ROUTES.length);
    expect(unresolved).toEqual([]);
  });

  it('[DOC-012] operations and method-and-path pairs are unique, and every signed-in route documents 401', () => {
    const ids = API_ROUTES.map((r) => r.operationId);
    const pairs = API_ROUTES.map((r) => `${r.method} ${r.path}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const route of API_ROUTES.filter((r) => r.auth !== 'none')) {
      expect(Object.keys(route.responses), route.operationId).toContain('401');
    }
  });

  it('[DOC-012] a portal session needs the CSRF token on unsafe methods; an ltik works everywhere', () => {
    // Arrange
    const security = (operationId: string) =>
      (operationOf(API_ROUTES.find((r) => r.operationId === operationId) as ApiRoute) as Operation).security;
    // Act and assert
    expect(security('getMe')).toEqual([{ portalSession: [] }, { ltik: [] }]);
    expect(security('publishContent')).toEqual([{ portalSession: [], csrfToken: [] }, { ltik: [] }]);
    expect(security('getApiDocs')).toEqual([]);
  });

  it('[DOC-012] refuses to build a document for a route whose schema has no name', () => {
    // Arrange
    const unnamed: ApiRoute = {
      operationId: 'probe',
      method: 'get',
      path: '/probe',
      auth: 'either',
      summary: 'A route with an anonymous answer schema.',
      responses: { 200: { description: 'Anything.', schema: z.object({ x: z.string() }) } },
    };
    // Act and assert
    expect(() => buildOpenApiDocument([unnamed])).toThrow(/GET \/probe: the schema has no name/);
  });
});
