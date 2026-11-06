/**
 * Tests the insight route registry: the view, contexts, CSV export and findings routes build an OpenAPI document whose
 * references resolve, work from the portal and from Canvas, document their refusals, take no learner, and are part of
 * `API_ROUTES` once each.
 *
 * Spec: DOC-012, INS-001, INS-006, INS-007, INS-009, INS-010
 */
import { describe, expect, it } from 'vitest';
import { INSIGHT_ROUTES } from '../src/routes/insightRoutes.js';
import { GRADE_BRIDGE_ROUTES } from '../src/routes/gradeBridgeRoutes.js';
import {
  API_ROUTES,
  buildOpenApiDocument,
  CSV_MEDIA_TYPE,
  RESPONSE_SCHEMAS,
  type ApiRoute,
} from '../src/index.js';

type Parameter = { name: string; in: string; required: boolean };
type Operation = {
  security: Record<string, string[]>[];
  parameters?: Parameter[];
  responses: Record<string, { content?: Record<string, unknown>; headers?: Record<string, unknown> }>;
};

const document = buildOpenApiDocument(INSIGHT_ROUTES);
const BASE = '/api/content/{contentId}/insight';
const operation = (path: string) =>
  (document.paths[path] as Record<string, Operation> | undefined)?.get as Operation;
const refsIn = (node: unknown): string[] =>
  typeof node !== 'object' || node === null
    ? []
    : Object.entries(node).flatMap(([key, value]) =>
        key === '$ref' && typeof value === 'string' ? [value] : refsIn(value),
      );

describe('[DOC-012] insight routes', () => {
  it('[INS-007] every route is a GET for a portal session or an ltik, and documents 401, 403, 404 and 429', () => {
    // Act
    const operations = ['', '/contexts', '/export', '/findings'].map((suffix) => operation(BASE + suffix));
    // Assert
    for (const op of operations) {
      expect(op.security).toEqual([{ portalSession: [] }, { ltik: [] }]);
      expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(['200', '401', '403', '404', '429']));
      expect(JSON.stringify(op.responses['429'])).toContain('Retry-After');
    }
    expect(Object.keys(operation(BASE).responses).sort()).toEqual(['200', '400', '401', '403', '404', '429']);
  });

  it('[INS-007] the view and the export take only the period, the context and the version, each optional', () => {
    // Act
    const queryOf = (op: Operation) => (op.parameters ?? []).filter((p) => p.in === 'query');
    // Assert
    for (const op of [operation(BASE), operation(`${BASE}/export`)]) {
      expect(queryOf(op).map((p) => [p.name, p.required])).toEqual([
        ['period', false],
        ['context', false],
        ['version', false],
      ]);
    }
    expect(queryOf(operation(`${BASE}/contexts`))).toEqual([]);
  });

  it('[INS-009] the export answers a UTF-8 CSV file as an attachment', () => {
    // Act
    const ok = operation(`${BASE}/export`).responses['200'];
    // Assert
    expect(CSV_MEDIA_TYPE).toBe('text/csv; charset=utf-8');
    expect(Object.keys(ok?.content ?? {})).toEqual([CSV_MEDIA_TYPE]);
    expect(ok?.headers).toHaveProperty('Content-Disposition');
  });

  it('[INS-006] no route names a learner, and no answer schema has a per-learner field', () => {
    // Arrange
    const names = (node: unknown): string[] =>
      typeof node !== 'object' || node === null
        ? []
        : Object.entries(node).flatMap(([key, value]) =>
            key === 'properties' && typeof value === 'object' && value !== null
              ? [...Object.keys(value), ...names(value)]
              : names(value),
          );
    const components = (document.components as { schemas: Record<string, unknown> }).schemas;
    // Act
    const fields = ['InsightReport', 'InsightContextsResponse', 'InsightFindingsResponse'].flatMap((name) =>
      names(components[name]),
    );
    const parameters = Object.values(document.paths).flatMap((path) =>
      Object.values(path as Record<string, Operation>).flatMap((op) =>
        (op.parameters ?? []).map((p) => p.name),
      ),
    );
    // Assert
    expect(fields).toEqual(expect.arrayContaining(['participation', 'items', 'contexts', 'findings']));
    expect(
      fields.filter((name) => /learnerKey|attemptId|user|actor|^sub$|response|email/i.test(name)),
    ).toEqual([]);
    expect([...new Set(parameters)].sort()).toEqual(['contentId', 'context', 'period', 'version']);
  });

  it('[DOC-012] every reference resolves, and the three answers are named components', () => {
    // Act
    const components = (document.components as { schemas: Record<string, unknown> }).schemas;
    const refs = refsIn(document.paths);
    // Assert
    expect(refs.filter((ref) => !(ref.replace('#/components/schemas/', '') in components))).toEqual([]);
    for (const name of ['InsightReport', 'InsightContextsResponse', 'InsightFindingsResponse'])
      expect(RESPONSE_SCHEMAS).toHaveProperty(name);
  });

  it('[DOC-012] is in API_ROUTES once each, before the grade bridge’s, with IDs and paths no other area uses', () => {
    // Arrange
    const registered: readonly ApiRoute[] = API_ROUTES;
    const key = (route: ApiRoute) => `${route.method} ${route.path}`;
    const start = registered.length - GRADE_BRIDGE_ROUTES.length - INSIGHT_ROUTES.length;
    const others = registered.filter((route) => !(INSIGHT_ROUTES as readonly ApiRoute[]).includes(route));
    // Act
    const ids = new Set(others.map((route) => route.operationId));
    const pairs = new Set(others.map(key));
    // Assert
    expect(registered.slice(start, start + INSIGHT_ROUTES.length)).toEqual(INSIGHT_ROUTES);
    for (const route of INSIGHT_ROUTES) {
      expect(ids.has(route.operationId), route.operationId).toBe(false);
      expect(pairs.has(key(route)), key(route)).toBe(false);
    }
  });
});
