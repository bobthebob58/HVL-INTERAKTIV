/**
 * Integration tests for the limits on a learner's saved state (D-120): only the names the player sends, a bounded
 * number of states and bytes per learner, activity and course, a bounded number of saves a minute, no way past the
 * limits by saving at the same moment, and a player page that still opens for a learner at the limits.
 *
 * Spec: H5P-005
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { LEARNER_STATE_LIMITS, STATE_SAVES_PER_MINUTE } from '../../src/h5p/storage/learnerStateLimits.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { requestAs } from '../support/requestAs.js';
import { describeWithServices, serviceEnv } from '../support/services.js';

const KB = 1024;

describeWithServices('[H5P-005] limits on a learner’s saved state', () => {
  let tb: HttpTestbed;
  let redis: Redis;
  let published: string;
  let other: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    redis = await connectRedis(serviceEnv().REDIS_URL);
    const author = await tb.actor('author');
    published = await tb.activity(author, { published: true });
    other = await tb.activity(author, { published: true });
  }, 60_000);
  afterAll(async () => {
    await redis.quit();
    await tb.close();
  });

  const url = (contentId: string, dataType = 'state', part = '0') =>
    `/h5p/contentUserData/${contentId}/${dataType}/${part}`;
  const save = (who: TestActor, data: string, part = '0', contentId = published) =>
    requestAs(tb.app, who, 'post', url(contentId, 'state', part))
      .type('form')
      .send({ data, preload: '1', invalidate: '1' });
  const stored = (who: TestActor, contentId = published) =>
    tb.db.h5PUserData.findMany({ where: { contentId, learnerKey: who.actor.learnerKey } });

  it('[H5P-005] a data type or a sub-content ID the player never sends is 400, for a save and for a read, and stores nothing', async () => {
    // Arrange
    const learner = await tb.actor('learner');
    const names = [
      ['progress', '0'],
      ['state', 'chapter-1'],
      ['state', '00'],
      ['state%00', '0'],
      ['state', `0%00`],
      ['state', `${randomUUID()}x`],
    ] as const;
    // Act and assert
    for (const [dataType, part] of names) {
      const path = url(published, dataType, part);
      const saved = await requestAs(tb.app, learner, 'post', path).type('form').send({ data: '{}' });
      const read = await requestAs(tb.app, learner, 'get', path);
      expect([saved.status, read.status], path).toEqual([400, 400]);
    }
    expect((await save(learner, '{"a":1}', randomUUID())).status).toBe(200);
    expect(await stored(learner)).toHaveLength(1);
  });

  it('[H5P-005] a state past the size limits is 413 and stores nothing; replacing and deleting still work at the limit', async () => {
    // Arrange: two states of 400 KB each (the limit for one is 512 KB, for all 1 MB)
    const learner = await tb.actor('learner');
    const [first, second] = [randomUUID(), randomUUID()];
    const big = 'x'.repeat(400 * KB);
    // Act
    const tooLarge = await save(learner, 'x'.repeat(LEARNER_STATE_LIMITS.rowBytes));
    const kept = [await save(learner, big), await save(learner, big, first)];
    const pastTotal = await save(learner, big, second);
    const replaced = await save(learner, 'y'.repeat(500 * KB), first);
    const deleted = await save(learner, '0', first);
    const afterDelete = await save(learner, big, second);
    // Assert
    expect([tooLarge.status, pastTotal.status]).toEqual([413, 413]);
    expect(kept.map((res) => res.status)).toEqual([200, 200]);
    expect([replaced.status, deleted.status, afterDelete.status]).toEqual([200, 200, 200]);
    expect((await stored(learner)).map((row) => row.subContentId).sort()).toEqual(['0', second].sort());
  });

  it('[H5P-005] one state more than the limit is refused, also when many are saved at the same moment', async () => {
    // Arrange
    const learner = await tb.actor('learner');
    const parts = Array.from({ length: LEARNER_STATE_LIMITS.rows + 10 }, () => randomUUID());
    // Act: all at once, then one more, then a replacement of a stored one
    const answers = await Promise.all(parts.map((part) => save(learner, '{"a":1}', part)));
    const oneMore = await save(learner, '{"a":1}', randomUUID());
    const rows = await stored(learner);
    const replaced = await save(learner, '{"a":2}', rows[0]?.subContentId);
    // Assert
    expect(answers.filter((res) => res.status === 200)).toHaveLength(LEARNER_STATE_LIMITS.rows);
    expect(answers.filter((res) => res.status === 413)).toHaveLength(10);
    expect([oneMore.status, replaced.status]).toEqual([413, 200]);
    expect(rows).toHaveLength(LEARNER_STATE_LIMITS.rows);
  });

  it('[H5P-005] saves past the limit per minute are 429 with Retry-After, for that learner and activity only', async () => {
    // Arrange
    const [learner, neighbour] = [await tb.actor('learner'), await tb.actor('learner')];
    // Act
    const statuses: number[] = [];
    for (let n = 0; n < STATE_SAVES_PER_MINUTE; n += 1)
      statuses.push((await save(learner, `{"n":${n}}`)).status);
    const past = await save(learner, '{"n":"past"}');
    const elsewhere = await save(learner, '{"n":1}', '0', other);
    const someoneElse = await save(neighbour, '{"n":1}');
    // Assert
    expect(new Set(statuses)).toEqual(new Set([200]));
    expect(past.status).toBe(429);
    expect(Number(past.headers['retry-after'])).toBeGreaterThan(0);
    expect(past.body).toMatchObject({ errorCode: 'hvl:rate-limited' });
    expect([elsewhere.status, someoneElse.status]).toEqual([200, 200]);
    // Assert: IDs that name no activity share one counter per person, so they cannot make any number of counters
    const keysBefore = (await redis.keys('hvli:state-saves:*')).length;
    for (const made of ['not-an-activity', 'another-one', 'a-third']) await save(neighbour, '{}', '0', made);
    expect((await redis.keys('hvli:state-saves:*')).length).toBe(keysBefore + 1);
    expect((await stored(learner))[0]?.data).toBe(`{"n":${STATE_SAVES_PER_MINUTE - 1}}`);
  });

  it('[H5P-005] the player page of a learner with more stored than the limits still opens', async () => {
    // Arrange: rows put straight into the table, as if stored before the limits
    const learner = await tb.actor('learner');
    const row = (subContentId: string, data: string) => ({
      contentId: published,
      subContentId,
      dataType: 'state',
      learnerKey: learner.actor.learnerKey,
      contextId: learner.actor.contextId ?? '',
      data,
      preload: true,
    });
    const many = Array.from({ length: 40 }, () => row(randomUUID(), 'z'.repeat(100 * KB)));
    await tb.db.h5PUserData.createMany({ data: [row('0', '{"answers":[1]}'), ...many] });
    // Act
    const page = await requestAs(tb.app, learner, 'get', `/h5p/play/${published}`);
    // Assert
    expect(page.status).toBe(200);
    expect(page.text).toContain('answers');
    expect(page.text.length).toBeLessThan(2 * LEARNER_STATE_LIMITS.totalBytes);
  });
});
