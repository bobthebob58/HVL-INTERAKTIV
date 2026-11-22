/**
 * Tests for the gate on saved-state writes: only a few saves are read and stored at the same time, the others wait
 * their turn before their body is read, a save past a full line is answered 429 with `Retry-After`, and a place is
 * given back however a save ends.
 *
 * Spec: H5P-005, NFR-002
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { h5pErrorHandler } from '../../src/http/h5pErrorHandler.js';
import type { H5pRouteDeps } from '../../src/http/h5pRouteDeps.js';
import { STATE_SAVE_GATE_LIMITS } from '../../src/http/routes/stateSaveGate.js';
import { userDataRoutes } from '../../src/http/routes/userDataRoutes.js';
import type { GateLimits } from '../../src/infra/BoundedGate.js';
import { createLogger } from '../../src/logging/logger.js';
import { testActor } from '../support/testActors.js';

const LEARNER = testActor('learner');

/** The save routes with a storage that holds every save until `release`, and fails for the activity `failing`. */
function saveRoutes(limits: GateLimits, failing?: string) {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  const stored: string[] = [];
  const manager = {
    createOrUpdateContentUserData: async (contentId: string) => {
      stored.push(contentId);
      await held;
      if (contentId === failing) throw new Error('the database is away');
    },
  };
  const allowed = { take: () => Promise.resolve({ allowed: true }) };
  const deps = {
    editor: { contentUserDataManager: manager },
    limits: { stateSaves: allowed, stateSaveGate: limits },
  } as unknown as H5pRouteDeps;
  const app = express();
  app.use((_req, res, next) => {
    res.locals.h5pActor = LEARNER;
    next();
  });
  app.use(userDataRoutes(deps), h5pErrorHandler(createLogger({ level: 'silent' })));
  const save = (contentId: string, body: Record<string, string> = { data: '{"a":1}' }) =>
    request(app)
      .post(`/contentUserData/${contentId}/state/0`)
      .type('form')
      .send(body)
      .then((res) => res);
  return { save, stored, release: () => release() };
}
const pause = (ms: number) => new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), ms));

describe('[H5P-005] how many saved states are handled at once', () => {
  it('[H5P-005] one save is stored at a time, the next waits before its body is read, and a third is 429', async () => {
    // Arrange: one place, one in line; the second save has a body the route refuses once it reads it
    const { save, stored, release } = saveRoutes({ atOnce: 1, waiting: 1 });
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
    const first = save(a);
    await pause(100);
    const second = save(b, { notData: 'x' });
    // Act
    const secondWhileHeld = await Promise.race([second, pause(150)]);
    const third = await save(c);
    release();
    const answers = await Promise.all([first, second]);
    // Assert: the waiting save was not read (it would have been refused at once), and the third was turned away
    expect(secondWhileHeld).toBe('pending');
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ errorCode: 'hvl:rate-limited' });
    expect(third.headers['retry-after']).toBe('1');
    expect(answers.map((res) => res.status)).toEqual([200, 400]);
    expect(stored).toEqual([a]);
  });

  it('[NFR-002] a save that fails gives its place to the next in line', async () => {
    // Arrange
    const failing = randomUUID();
    const next = randomUUID();
    const { save, stored, release } = saveRoutes({ atOnce: 1, waiting: 1 }, failing);
    const first = save(failing);
    await pause(100);
    const second = save(next);
    // Act
    release();
    const answers = await Promise.all([first, second]);
    // Assert
    expect(answers.map((res) => res.status)).toEqual([500, 200]);
    expect(stored).toEqual([failing, next]);
  });

  it('[H5P-005] the limits outside tests are eight at once and two hundred waiting', () => {
    expect(STATE_SAVE_GATE_LIMITS).toEqual({ atOnce: 8, waiting: 200 });
  });
});
