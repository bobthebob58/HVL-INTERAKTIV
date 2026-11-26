/**
 * Integration test for what the player preloads of a learner's state: only states marked for it, the main one
 * first, and never more rows or bytes than one learner may store (D-120), whatever the table holds.
 *
 * Spec: H5P-005
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { LEARNER_STATE_LIMITS } from '../../src/h5p/storage/learnerStateLimits.js';
import {
  newLearner,
  openLearnerStateFixture,
  type LearnerStateFixture,
} from '../support/learnerStateFixtures.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[H5P-005] learner state on PostgreSQL: the preload is bounded', () => {
  let fx: LearnerStateFixture;
  beforeAll(async () => {
    fx = await openLearnerStateFixture();
  });
  afterAll(() => fx.close());

  it('[H5P-005] the preload holds only states marked for it, the main one first, within the row and byte limits', async () => {
    // Arrange: more rows and bytes than a learner may store, put straight into the table
    const content = await fx.newContent();
    const amina = newLearner();
    const row = (subContentId: string, data: string, preload = true) => ({
      contentId: content,
      subContentId,
      dataType: 'state',
      learnerKey: amina,
      contextId: '',
      data,
      preload,
    });
    const small = Array.from({ length: 30 }, () => row(randomUUID(), '{"s":1}'));
    const large = Array.from({ length: 4 }, (_, n) =>
      row(`0000000${n}-0000-4000-8000-000000000000`, 'x'.repeat(400 * 1024)),
    );
    await fx.db.h5PUserData.createMany({
      data: [...large, ...small, row('0', '{"main":true}'), row(randomUUID(), '{"hidden":1}', false)],
    });
    // Act
    const preload = await fx.storage.getContentUserDataByContentIdAndUser(content, amina);
    // Assert
    const bytes = preload.reduce((sum, state) => sum + String(state.userState).length, 0);
    expect(preload[0]?.userState).toBe('{"main":true}');
    expect(preload.length).toBeLessThanOrEqual(LEARNER_STATE_LIMITS.rows);
    expect(bytes).toBeLessThanOrEqual(LEARNER_STATE_LIMITS.totalBytes);
    expect(preload.some((state) => state.userState === '{"hidden":1}')).toBe(false);
    expect(preload.filter((state) => String(state.userState).length > 1000)).toHaveLength(2);
  });
});
