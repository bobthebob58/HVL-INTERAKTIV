/**
 * healthRoutes — `GET /healthz` for load balancers and the deployment pipeline.
 *
 * Why: a node whose database or Redis is unreachable must be taken out of rotation instead of answering users
 *      with errors. The check is cheap (one query, one PING) and bounded in time.
 * Spec: NFR-002
 * Invariants:
 *   - 200 `{ status: 'ok' }` when both answer within the time limit, otherwise 503 with the names of the failing
 *     dependencies only; no error text, host name or version is revealed.
 *   - Never cached; needs no authentication.
 * Collaborators: ./createApp.ts, ../infra/prismaClient.ts, ../infra/redisClient.ts.
 * Tests: apps/server/test/server/healthRoutes.test.ts
 */
import { Router } from 'express';

/** Milliseconds each dependency has to answer. */
export const HEALTH_TIMEOUT_MS = 2000;

/** The dependencies the health check pings. */
export interface HealthDeps {
  /** Runs `SELECT 1` (or equivalent) against PostgreSQL. */
  readonly database: () => Promise<unknown>;
  /** Sends PING to Redis. */
  readonly redis: () => Promise<unknown>;
}

const answersInTime = async (check: () => Promise<unknown>, timeoutMs: number): Promise<boolean> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([check().then(() => true), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Builds the health route.
 * @param deps - How to ping the database and Redis.
 * @param timeoutMs - How long each may take.
 * @returns A router for `GET /healthz`.
 */
export function healthRoutes(deps: HealthDeps, timeoutMs = HEALTH_TIMEOUT_MS): Router {
  const router = Router();
  router.get('/healthz', async (_req, res) => {
    const [database, redis] = await Promise.all([
      answersInTime(deps.database, timeoutMs),
      answersInTime(deps.redis, timeoutMs),
    ]);
    const failing = [...(database ? [] : ['database']), ...(redis ? [] : ['redis'])];
    res.set('Cache-Control', 'no-store');
    res
      .status(failing.length === 0 ? 200 : 503)
      .json(failing.length === 0 ? { status: 'ok' } : { status: 'unavailable', failing });
  });
  return router;
}
