/**
 * Tests for the health check: ok, failing and slow dependencies.
 *
 * Spec: NFR-002
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { healthRoutes, type HealthDeps } from '../../src/server/healthRoutes.js';

const appWith = (deps: HealthDeps) => express().use(healthRoutes(deps));
const ok = () => Promise.resolve(1);

describe('[NFR-002] health check', () => {
  it('[NFR-002] answers 200 when the database and Redis answer, and is never cached', async () => {
    const res = await request(appWith({ database: ok, redis: ok })).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('[NFR-002] answers 503 naming only the failing dependency, without its error text', async () => {
    const failing = () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=x'));
    const res = await request(appWith({ database: failing, redis: ok })).get('/healthz');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable', failing: ['database'] });
  });

  it('[NFR-002] treats a dependency that does not answer in time as failing', async () => {
    const app = express().use(healthRoutes({ database: ok, redis: () => new Promise(() => {}) }, 50));
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable', failing: ['redis'] });
  });
});
