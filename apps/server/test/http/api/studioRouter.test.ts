/**
 * Unit tests for the studio router: it mounts one router per area, at its root and in the registry's order, each
 * built from the same inputs, so the registry test sees every studio route; each real area module builds a router
 * that keeps its middleware to its own routes.
 *
 * Spec: DOC-012
 */
import express, { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../../../src/config/env.js';
import { studioRouter } from '../../../src/http/api/studioRouter.js';
import type { HvlH5PEditor } from '../../../src/h5p/HvlH5PEditor.js';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import type { StudioRouteDeps } from '../../../src/learningDesign/http/studioRouteDeps.js';
import { createLogger } from '../../../src/logging/logger.js';
import { createStudioServices, type StudioServiceInputs } from '../../../src/server/studioServices.js';
import { VALID_ENV } from '../../support/authEnv.js';
import { mountedRoutes } from '../../support/expressRoutes.js';

// WHY: vi.mock factories run before this module's own lines, so what they use is created in vi.hoisted.
const { AREAS, built, areaModule } = vi.hoisted(() => {
  /** Each area's builder records the inputs it got and answers one route named after the area. */
  const inputs = new Map<string, unknown>();
  return {
    AREAS: {
      studioContentRoutes: '../../../src/learningDesign/http/studioContentRoutes.js',
      patternRoutes: '../../../src/learningDesign/http/patternRoutes.js',
      learningDesignRoutes: '../../../src/learningDesign/http/learningDesignRoutes.js',
      collaborationRoutes: '../../../src/learningDesign/http/collaborationRoutes.js',
      mappeRoutes: '../../../src/learningDesign/http/mappeRoutes.js',
    },
    built: inputs,
    areaModule: async (name: string) => {
      const { Router } = await import('express');
      return {
        [name]: (deps: unknown) => {
          inputs.set(name, deps);
          return Router().get(`/test-${name}`, (_req, res) => void res.json({ area: name }));
        },
      };
    },
  };
});
vi.mock('../../../src/learningDesign/http/studioContentRoutes.js', () => areaModule('studioContentRoutes'));
vi.mock('../../../src/learningDesign/http/patternRoutes.js', () => areaModule('patternRoutes'));
vi.mock('../../../src/learningDesign/http/learningDesignRoutes.js', () => areaModule('learningDesignRoutes'));
vi.mock('../../../src/learningDesign/http/collaborationRoutes.js', () => areaModule('collaborationRoutes'));
vi.mock('../../../src/learningDesign/http/mappeRoutes.js', () => areaModule('mappeRoutes'));

// WHY: the router only hands these on, so plain stand-ins show that every area gets the very same object.
const deps = { db: {}, access: {}, clock: () => new Date(0), studio: {} } as unknown as StudioRouteDeps;

interface StackLayer {
  readonly name: string;
  readonly route?: unknown;
  readonly slash?: boolean;
  readonly handle?: { readonly stack?: unknown };
}

/** The names of a router's path-less middleware (`router.use(fn)`), also inside routers mounted at its root. */
const pathlessMiddleware = (router: unknown): string[] =>
  ((router as { stack?: StackLayer[] }).stack ?? []).flatMap((layer) => {
    if (layer.route || !layer.slash) return [];
    return Array.isArray(layer.handle?.stack) ? pathlessMiddleware(layer.handle) : [layer.name];
  });

describe('[DOC-012] studioRouter', () => {
  it('[DOC-012] mounts every area at its root, in the registry order, each built from the same inputs', () => {
    // Act
    const routes = mountedRoutes(studioRouter(deps));
    // Assert
    expect(routes).toEqual(Object.keys(AREAS).map((name) => ({ method: 'get', path: `/test-${name}` })));
    expect([...built.keys()]).toEqual(Object.keys(AREAS));
    for (const got of built.values()) expect(got).toBe(deps);
  });

  it('[DOC-012] a request below the studio router reaches the area that answers its path', async () => {
    // Arrange
    const app = express().use('/api', studioRouter(deps));
    // Act
    const answers = await Promise.all(
      Object.keys(AREAS).map(async (name) => (await request(app).get(`/api/test-${name}`)).body),
    );
    // Assert
    expect(answers).toEqual(Object.keys(AREAS).map((name) => ({ area: name })));
  });

  it('[DOC-012] each real area module builds an Express router whose sub-routers are mounted at its root', async () => {
    // Arrange: the real services over the real content and configuration; building a router contacts no service, so
    // the clients and the editor are empty stand-ins
    const clients = { db: {}, redis: {}, access: {}, hasher: {}, publishing: {} };
    const editor = { libraryManager: {} } as HvlH5PEditor;
    const configured = { env: loadEnv(VALID_ENV), logger: createLogger({ level: 'silent' }) };
    const inputs = { ...clients, ...configured, h5p: { editor }, studioContent: loadStudioContent() };
    const studio = createStudioServices(inputs as unknown as StudioServiceInputs);
    const realDeps: StudioRouteDeps = { ...deps, studio };
    // Act
    const routers = await Promise.all(
      Object.entries(AREAS).map(async ([name, path]) => {
        const actual = await vi.importActual<Record<string, (input: StudioRouteDeps) => unknown>>(path);
        return actual[name]?.(realDeps);
      }),
    );
    // Assert: a router mounted below a path would hide its routes from the registry test (mountedRoutes throws), and
    // a path-less middleware would also run for the later areas' requests
    for (const router of routers) {
      expect(typeof router).toBe('function');
      expect(() => mountedRoutes(router)).not.toThrow();
      expect(pathlessMiddleware(router)).toEqual([]);
    }
  });

  it('[DOC-012] the leak check finds path-less middleware, also in a root sub-router, and allows scoped middleware', () => {
    // Arrange
    const scoped = (_req: unknown, _res: unknown, next: () => void) => next();
    const nested = Router().use(express.json());
    // Act
    const leaking = pathlessMiddleware(Router().use(nested).get('/x', express.json(), scoped));
    const contained = pathlessMiddleware(
      Router().use('/mappe', scoped).post('/mappe/export', express.json()),
    );
    // Assert
    expect(leaking).toEqual(['jsonParser']);
    expect(contained).toEqual([]);
  });
});
