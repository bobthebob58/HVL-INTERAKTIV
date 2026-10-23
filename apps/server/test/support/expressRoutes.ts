/**
 * expressRoutes — lists the routes an Express router really mounts, by walking its layer stack.
 *
 * Why: DOC-012 asks that every `/api` route be described; comparing the registry with what Express mounts (not with
 *      a second hand-written list) is the only check that catches a route added without its contract entry.
 * Spec: DOC-012
 * Invariants:
 *   - Sub-routers are followed only when mounted at the root (`router.use(sub)`), so a route's path is its full path
 *     below the router; a sub-router mounted below a path throws, because its mount path is not kept by Express 5.
 *   - Plain middleware (body parsers, headers, fallbacks) is not a route and is skipped.
 * Collaborators: express 5's `router` package (`Layer.route`, `Layer.handle.stack`, `Layer.slash`).
 * Tests: apps/server/test/http/api/apiDocs.int.test.ts
 */

/** One method and path a router answers. */
export interface MountedRoute {
  /** Lower case, e.g. `get`. */
  readonly method: string;
  /** The route path as written, e.g. `/content/:contentId`. */
  readonly path: string;
}

interface Layer {
  readonly route?: { readonly path: string; readonly methods: Record<string, boolean> };
  readonly handle?: { readonly stack?: unknown };
  readonly slash?: boolean;
}

/**
 * The routes of a router and of the routers mounted at its root.
 * @param router - An Express `Router()` (or anything with a layer `stack`).
 * @returns Every method and path, in mount order.
 * @throws Error when a sub-router is mounted below a path.
 */
export function mountedRoutes(router: unknown): MountedRoute[] {
  const stack = ((router as { stack?: unknown }).stack ?? []) as Layer[];
  return stack.flatMap((layer): MountedRoute[] => {
    if (layer.route) {
      const { path, methods } = layer.route;
      return Object.keys(methods)
        .filter((method) => method !== '_all')
        .map((method) => ({ method, path }));
    }
    if (!Array.isArray(layer.handle?.stack)) return [];
    if (!layer.slash) throw new Error('a sub-router is mounted below a path; mount it at the root');
    return mountedRoutes(layer.handle);
  });
}
