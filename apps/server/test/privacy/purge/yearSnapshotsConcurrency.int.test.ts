/**
 * Integration test for the yearly purge's snapshots under concurrency (D-107's amendment of 2026-11-04): two writers
 * at once (two nodes after a lease expired, or the job and the CLI) write a year's snapshots once, because each takes
 * the advisory lock and checks again inside its transaction.
 *
 * Spec: DATA-003
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { writeYearSnapshots } from '../../../src/privacy/purge/yearSnapshots.js';
import { describeWithServices } from '../../support/services.js';
import { openPurgeFixture, type PurgeFixture } from './support/purgeFixture.js';

describeWithServices('[DATA-003] the yearly purge’s snapshots under concurrency', () => {
  let fx: PurgeFixture;
  beforeAll(async () => {
    fx = await openPurgeFixture(2019);
  });
  afterAll(() => fx.close());

  it('[DATA-003] two writers at once write the year’s snapshots once', async () => {
    // Arrange
    const write = () => writeYearSnapshots(fx.db, minimumGroupSize(5), fx.current);
    // Act
    const written = await Promise.all([write(), write(), write()]);
    // Assert
    expect([...written].sort()).toEqual([0, 0, 3]);
    expect(await fx.db.insightSnapshot.count({ where: { contentId: fx.contentId } })).toBe(3);
  });
});
