/**
 * Integration tests for the per-person limit on new activities (D-128): the save of a new activity past the limit
 * is 429 with `Retry-After` and stores nothing, an edit of an existing activity is not counted, and another
 * author goes on.
 *
 * Spec: PROD-007, SEC-005
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CREATIONS_PER_TEN_MINUTES } from '../../src/http/h5pRouteLimits.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { requestAs } from '../support/requestAs.js';
import { describeWithServices } from '../support/services.js';

const body = {
  library: 'H5P.MultiChoice 1.16',
  params: { params: { question: 'Kva?' }, metadata: { title: 'Q', license: 'U' } },
};

describeWithServices('[PROD-007] the per-person limit on new activities', () => {
  let tb: HttpTestbed;
  beforeAll(async () => {
    tb = await openHttpTestbed();
  }, 60_000);
  afterAll(() => tb.close());

  it('[PROD-007] new activities past an author’s limit are 429 with Retry-After and store nothing; edits and others go on', async () => {
    // Arrange
    const [author, colleague] = [await tb.actor('author'), await tb.actor('author')];
    const create = (who: TestActor) => requestAs(tb.app, who, 'post', '/h5p/content').send(body);
    const owned = () => tb.db.h5PContent.count({ where: { ownerUserId: author.actor.accountId } });
    // Act
    const created: { status: number; id: string }[] = [];
    for (let n = 0; n < CREATIONS_PER_TEN_MINUTES; n += 1) {
      const res = await create(author);
      created.push({ status: res.status, id: res.body.contentId as string });
    }
    const past = await create(author);
    const edit = await requestAs(tb.app, author, 'put', `/h5p/content/${created[0]?.id ?? ''}`).send(body);
    const other = await create(colleague);
    // Assert
    expect(new Set(created.map((answer) => answer.status))).toEqual(new Set([201]));
    expect(past.status).toBe(429);
    expect(Number(past.headers['retry-after'])).toBeGreaterThan(0);
    expect(past.body).toMatchObject({ errorCode: 'hvl:rate-limited' });
    expect(await owned()).toBe(CREATIONS_PER_TEN_MINUTES);
    expect([edit.status, other.status]).toEqual([200, 201]);
  }, 120_000);
});
