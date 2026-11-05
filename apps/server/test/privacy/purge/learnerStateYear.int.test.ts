/**
 * Integration tests for the year an H5P state row stores (D-107's amendments of 2026-11-04): a state saved through
 * the state route stores the academic year of the learner's key, carried on the H5P actor, not the year of the write;
 * so a portal session made before 1 August and used after it stores the old year and goes with that year's purge.
 *
 * Spec: DATA-003, H5P-005
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { academicYearOf } from '../../../src/privacy/academicYear.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';

describeWithServices('[DATA-003] the academic year of H5P state rows', () => {
  let tb: HttpTestbed;
  let published: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    published = await tb.activity(await tb.actor('author'), { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  const save = (who: TestActor, data: string) =>
    requestAs(tb.app, who, 'post', `/h5p/contentUserData/${published}/state/0`)
      .type('form')
      .send({ data, preload: '1', invalidate: '1' });
  const yearOf = async (who: TestActor) =>
    (
      await tb.db.h5PUserData.findFirstOrThrow({
        where: { contentId: published, learnerKey: who.actor.learnerKey },
        select: { academicYear: true },
      })
    ).academicYear;

  it('[DATA-003] stores the year of the learner’s key on insert and on update, not the year of the write', async () => {
    // Arrange: a portal session made before 1 August keeps last year's key (D-057).
    const learner = await tb.actor('learner', { learnerKeyYear: academicYearOf() - 1 });
    // Act
    await save(learner, '{"answers":[1]}');
    const inserted = await yearOf(learner);
    await tb.db.h5PUserData.updateMany({
      where: { learnerKey: learner.actor.learnerKey },
      data: { academicYear: academicYearOf() },
    });
    await save(learner, '{"answers":[2]}');
    // Assert: the update also writes the key's year, so a row the default misdated is set right.
    expect([inserted, await yearOf(learner)]).toEqual([academicYearOf() - 1, academicYearOf() - 1]);
  });

  it('[DATA-003] two learners saving at once each store their own key’s year', async () => {
    // Arrange
    const [older, newer] = await Promise.all([
      tb.actor('learner', { learnerKeyYear: 2024 }),
      tb.actor('learner', { learnerKeyYear: 2025 }),
    ]);
    // Act
    await Promise.all([save(older, '{"a":1}'), save(newer, '{"b":1}')]);
    // Assert
    expect([await yearOf(older), await yearOf(newer)]).toEqual([2024, 2025]);
  });

  it('[DATA-003] an actor without a key year keeps the database default, the academic year of the write', async () => {
    // Arrange
    const learner = await tb.actor('learner');
    // Act
    await save(learner, '{"answers":[3]}');
    // Assert
    expect(await yearOf(learner)).toBe(academicYearOf());
  });
});
