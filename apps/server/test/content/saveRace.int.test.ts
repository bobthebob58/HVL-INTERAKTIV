/**
 * Integration tests for a save and a publish of the same activity at the same time (D-074): with the Redis write
 * lock, a publish can no longer commit between the save gate's status read and Lumi's write, however the save's
 * URL spells the activity ID.
 *
 * Spec: PROD-003
 */
import { setTimeout as delay } from 'node:timers/promises';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ContentPublisher, type Publisher } from '../../src/content/ContentPublisher.js';
import { RedisContentWriteLock, writeLockKey } from '../../src/content/ContentWriteLock.js';
import { PublishedSaveGate } from '../../src/content/PublishedSaveGate.js';
import type { PublishingDeps } from '../../src/content/publishingDeps.js';
import { editorSavedForm } from '../../src/content/savedForm.js';
import { isAuthError } from '../../src/http/authErrors.js';
import type { HvlH5PEditor } from '../../src/h5p/HvlH5PEditor.js';
import type { Database } from '../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import type { ValidationInput } from '../../src/validation/types.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { altError } from '../support/publishFixtures.js';
import { describeWithServices, serviceEnv } from '../support/services.js';

/** A step that stops until the test lets it go on, and tells the test when it has stopped. */
function pausePoint() {
  let reached = (): void => undefined;
  let release = (): void => undefined;
  const hasReached = new Promise<void>((resolve) => (reached = resolve));
  const released = new Promise<void>((resolve) => (release = resolve));
  return { hasReached, release, wait: () => (reached(), released) };
}

/** Wraps an object so one of its methods first waits at a pause point. */
function pausing<T extends object>(target: T, method: string, at: () => Promise<void>, member?: string): T {
  return new Proxy(target, {
    get(object, property) {
      const value: unknown = Reflect.get(object, property);
      if (member === undefined && property === method && typeof value === 'function') {
        return async (...args: unknown[]) => (await at(), Reflect.apply(value, object, args) as unknown);
      }
      if (member !== undefined && property === member) return pausing(value as object, method, at);
      return typeof value === 'function' ? value.bind(object) : value;
    },
  });
}

const missingAlt = (input: ValidationInput) =>
  JSON.stringify(input.params).includes('utan alt') ? [altError] : [];

describeWithServices('[PROD-003] a save and a publish at the same time', () => {
  let tb: HttpTestbed;
  let redis: Redis;
  let author: TestActor;
  let deps: PublishingDeps;
  let by: Publisher;
  const editorPause = { current: undefined as ReturnType<typeof pausePoint> | undefined };

  const appWith = (gateDeps: PublishingDeps = deps): Express => {
    // WHY: Lumi's save waits here while the test lets a publish try to get in between.
    const editor = pausing(
      tb.runtime.editor,
      'saveOrUpdateContent',
      () => editorPause.current?.wait() ?? Promise.resolve(),
    );
    const saveGate = new PublishedSaveGate(gateDeps, editorSavedForm(tb.runtime.editor.libraryManager));
    return tb.appWith({ editor: editor as HvlH5PEditor, saveGate });
  };
  const save = (app: Express, id: string, question: string) =>
    request(app)
      .put(`/h5p/content/${id}`)
      .set(...author.header)
      .send({
        library: 'H5P.MultiChoice 1.16',
        params: { params: { question, answers: ['Ja'] }, metadata: { title: 'Q', license: 'U' } },
      })
      .then((res) => res);
  const stored = (id: string) => tb.db.h5PContent.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    tb = await openHttpTestbed();
    redis = await connectRedis(serviceEnv().REDIS_URL);
    author = await tb.actor('author');
    by = { userId: author.actor.accountId, mode: 'portal', locale: 'nn' };
    deps = {
      db: tb.db,
      validator: missingAlt,
      clock: () => new Date(),
      writeLock: new RedisContentWriteLock(redis),
    };
  }, 60_000);
  afterAll(async () => {
    await redis.quit();
    await tb.close();
  });

  // WHY: the editor saves to the ID as its URL spells it; the publish uses the stored, lower-case ID.
  it.each([
    ['the stored spelling', (id: string) => id],
    ['upper case', (id: string) => id.toUpperCase()],
  ])(
    '[PROD-003] a publish during Lumi’s save of a draft (ID in %s) waits for it, then is refused',
    async (_, spell) => {
      // Arrange
      const app = appWith();
      const id = await tb.activity(author);
      const checked = (await stored(id)).updatedAt.toISOString();
      editorPause.current = pausePoint();
      // Act
      const saving = save(app, spell(id), 'Bilete utan alt');
      await editorPause.current.hasReached;
      const publishing = new ContentPublisher(deps)
        .publish(id, by, { updatedAt: checked, acknowledgements: [] })
        .catch((error: unknown) => error);
      await delay(150);
      editorPause.current.release();
      const [saved, published] = await Promise.all([saving, publishing]);
      editorPause.current = undefined;
      // Assert
      expect(saved.status).toBe(200);
      expect(isAuthError(published, 'hvl:content-changed')).toBe(true);
      expect(await stored(id)).toMatchObject({ status: 'draft', params: { question: 'Bilete utan alt' } });
    },
  );

  it('[PROD-003] a save that waits longer than the lock allows is 409 hvl:content-changed and saves nothing', async () => {
    // Arrange
    const writeLock = new RedisContentWriteLock(redis, { leaseMs: 5000, waitMs: 100, pollMs: 10 });
    const app = appWith({ ...deps, writeLock });
    const id = await tb.activity(author);
    await redis.set(writeLockKey(id), 'held by another node', { PX: 5000 });
    // Act
    const saved = await save(app, id.toUpperCase(), 'Bilete utan alt').finally(() =>
      redis.del(writeLockKey(id)),
    );
    // Assert
    expect(saved.status).toBe(409);
    expect(saved.body.errorCode).toBe('hvl:content-changed');
    expect(await stored(id)).toMatchObject({ status: 'draft', params: { question: 'Kva?' } });
  });

  it('[PROD-003] a save during a publish waits for it, then meets the gate of a published activity', async () => {
    // Arrange
    const app = appWith();
    const id = await tb.activity(author);
    const checked = (await stored(id)).updatedAt.toISOString();
    const publishPause = pausePoint();
    const db = pausing(tb.db, 'findMany', publishPause.wait, 'validationAcknowledgement') as Database;
    // Act
    const publishing = new ContentPublisher({ ...deps, db }).publish(id, by, {
      updatedAt: checked,
      acknowledgements: [],
    });
    await publishPause.hasReached;
    const saving = save(app, id, 'Bilete utan alt');
    await delay(150);
    publishPause.release();
    const [published, saved] = await Promise.all([publishing, saving]);
    // Assert
    expect(published.status).toBe('published');
    expect(saved.status).toBe(409);
    expect(saved.body.errorCode).toBe('hvl:published-save-blocked');
    expect(await stored(id)).toMatchObject({ status: 'published', params: { question: 'Kva?' } });
  });
});
