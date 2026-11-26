/**
 * Integration tests for a delete and saves of the same activity at the same time (D-117): the delete holds the
 * activity's write lock, a save to an activity that is gone creates nothing, and the audit log names who deleted.
 *
 * Spec: H5P-006, PROD-007, DATA-007
 */
import { setTimeout as delay } from 'node:timers/promises';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { contentRouteGuards } from '../../src/content/contentRouteGuards.js';
import { RedisContentWriteLock } from '../../src/content/ContentWriteLock.js';
import type { HvlH5PEditor } from '../../src/h5p/HvlH5PEditor.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { pausePoint, pausing, type PausePoint } from '../support/pausePoints.js';
import { describeWithServices, serviceEnv } from '../support/services.js';

describeWithServices('[H5P-006] a delete and saves of one activity at the same time', () => {
  let tb: HttpTestbed;
  let redis: Redis;
  let app: Express;
  let owner: TestActor;
  let coAuthor: TestActor;
  const pause: { save?: PausePoint; remove?: PausePoint } = {};

  const save = (as: TestActor, id: string, question: string) =>
    request(app)
      .put(`/h5p/content/${id}`)
      .set(...as.header)
      .send({
        library: 'H5P.MultiChoice 1.16',
        params: { params: { question, answers: ['Ja'] }, metadata: { title: 'Q', license: 'U' } },
      })
      .then((res) => res);
  const remove = (as: TestActor, id: string) =>
    request(app)
      .delete(`/h5p/content/${id}`)
      .set(...as.header)
      .then((res) => res);
  const stored = (id: string) => tb.db.h5PContent.findUnique({ where: { id } });
  const deletions = (id: string) =>
    tb.db.auditEvent.findMany({ where: { action: 'content.delete', targetId: id } });
  /** An activity of `owner` that `coAuthor` may edit and delete. */
  const sharedActivity = async (): Promise<string> => {
    const id = await tb.activity(owner);
    await tb.db.contentCollaborator.create({ data: { contentId: id, userId: coAuthor.actor.accountId } });
    return id;
  };

  beforeAll(async () => {
    tb = await openHttpTestbed();
    redis = await connectRedis(serviceEnv().REDIS_URL);
    owner = await tb.actor('author');
    coAuthor = await tb.actor('author');
    const publishing = {
      db: tb.db,
      validator: () => [],
      clock: () => new Date(),
      writeLock: new RedisContentWriteLock(redis),
    };
    // WHY: the editor's save and delete wait here while the test sends the other request.
    const saving = pausing(
      tb.runtime.editor,
      'saveOrUpdateContent',
      () => pause.save?.wait() ?? Promise.resolve(),
    );
    const editor = pausing(saving, 'deleteContent', () => pause.remove?.wait() ?? Promise.resolve());
    app = tb.appWith({
      editor: editor as HvlH5PEditor,
      ...contentRouteGuards(publishing, tb.runtime.editor),
    });
  }, 60_000);
  afterAll(async () => {
    await redis.quit();
    await tb.close();
  });

  it('[H5P-006] a delete asked for during a save waits for it, and the audit log names who deleted', async () => {
    // Arrange
    const id = await sharedActivity();
    pause.save = pausePoint();
    // Act
    const saving = save(coAuthor, id, 'Ny tekst');
    await pause.save.hasReached;
    const deleting = remove(coAuthor, id);
    await delay(150);
    const during = await stored(id);
    pause.save.release();
    const [saved, deleted] = await Promise.all([saving, deleting]);
    pause.save = undefined;
    // Assert
    expect(during?.ownerUserId).toBe(owner.actor.accountId);
    expect([saved.status, deleted.status]).toEqual([200, 204]);
    expect(await stored(id)).toBeNull();
    expect(await deletions(id)).toMatchObject([
      {
        actorUserId: coAuthor.actor.accountId,
        targetType: 'H5PContent',
        details: { ownerUserId: owner.actor.accountId, status: 'draft' },
      },
    ]);
  });

  it('[H5P-006] a save asked for during a delete waits for it, is refused and creates nothing', async () => {
    // Arrange
    const id = await sharedActivity();
    pause.remove = pausePoint();
    // Act
    const deleting = remove(coAuthor, id);
    await pause.remove.hasReached;
    const saving = save(coAuthor, id, 'Ny tekst');
    await delay(150);
    pause.remove.release();
    const [deleted, saved] = await Promise.all([deleting, saving]);
    pause.remove = undefined;
    // Assert
    expect(deleted.status).toBe(204);
    expect([403, 404]).toContain(saved.status);
    expect(await stored(id)).toBeNull();
  });

  it('[PROD-007] many saves and one delete at once leave no activity behind, and never a new owner', async () => {
    // Arrange
    const id = await sharedActivity();
    const saves = (label: string) => Array.from({ length: 8 }, (_, n) => save(coAuthor, id, `${label} ${n}`));
    // Act
    const answers = await Promise.all([...saves('Før'), remove(coAuthor, id), ...saves('Etter')]);
    // Assert
    expect(
      answers.map((answer) => answer.status).filter((status) => ![200, 204, 403, 404].includes(status)),
    ).toEqual([]);
    expect(answers[8]?.status).toBe(204);
    expect(await stored(id)).toBeNull();
    expect(await deletions(id)).toHaveLength(1);
  });

  it('[DATA-007] a delete that is refused changes nothing and is not recorded as a delete', async () => {
    // Arrange
    const id = await sharedActivity();
    const stranger = await tb.actor('author');
    // Act
    const refused = await remove(stranger, id);
    // Assert
    expect(refused.status).toBe(403);
    expect((await stored(id))?.ownerUserId).toBe(owner.actor.accountId);
    expect(await deletions(id)).toEqual([]);
  });
});
