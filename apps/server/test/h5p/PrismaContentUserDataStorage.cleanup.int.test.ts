/**
 * Integration tests for deleting and invalidating learner state, and for what the store refuses to keep.
 *
 * Spec: H5P-005, PROD-008
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { IUser } from '@lumieducation/h5p-server';
import {
  ISSUER,
  SUB_A,
  learnerKeyOf,
  newLearner,
  openLearnerStateFixture,
  stateUser,
  type LearnerStateFixture,
} from '../support/learnerStateFixtures.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[H5P-005] learner state on PostgreSQL: deleting and data minimisation', () => {
  let fx: LearnerStateFixture;

  beforeAll(async () => {
    fx = await openLearnerStateFixture();
  });

  afterAll(() => fx.close());

  it('[H5P-005] data "0" deletes the state', async () => {
    // Arrange
    const content = await fx.newContent();
    const amina = newLearner();
    await fx.save(content, amina, { contextId: 'canvas-course-101' });
    await fx.save(content, amina, { contextId: 'canvas-course-202' });
    await fx.save(content, amina, { contextId: 'canvas-course-101', subContentId: SUB_A });
    // Act
    await fx.save(content, amina, { contextId: 'canvas-course-101', userState: '0' });
    // Assert: only the main state in that context is gone.
    expect(await fx.stateOf(content, amina, 'canvas-course-101')).toBeNull();
    expect(await fx.stateOf(content, amina, 'canvas-course-202')).not.toBeNull();
    expect(await fx.stateOf(content, amina, 'canvas-course-101', SUB_A)).not.toBeNull();
    // Act and assert: deleting again is no error, and the number 0 deletes too.
    await expect(fx.save(content, amina, { contextId: 'canvas-course-101', userState: '0' })).resolves.toBe(
      undefined,
    );
    // WHY: a JSON body would carry the number 0; it is the same delete signal.
    await fx.save(content, amina, { contextId: 'canvas-course-202', userState: 0 as unknown as string });
    expect(await fx.db.h5PUserData.count({ where: { contentId: content } })).toBe(1);
  });

  it('[H5P-005] deletes only invalidated state for an activity', async () => {
    // Arrange
    const [changed, other] = [await fx.newContent(), await fx.newContent()];
    const [amina, bjorn] = [newLearner(), newLearner()];
    await fx.save(changed, amina, { invalidate: true });
    await fx.save(changed, amina, { subContentId: SUB_A, contextId: 'canvas-course-101', invalidate: true });
    await fx.save(changed, bjorn, { invalidate: false });
    await fx.save(other, amina, { invalidate: true });
    // Act
    await fx.storage.deleteInvalidatedContentUserData(changed);
    // Assert: the state kept on change and the other activity's state are left.
    const left = await fx.db.h5PUserData.findMany({
      where: { contentId: { in: [changed, other] } },
      select: { contentId: true, learnerKey: true },
    });
    expect(left).toHaveLength(2);
    expect(left).toEqual(
      expect.arrayContaining([
        { contentId: changed, learnerKey: bjorn },
        { contentId: other, learnerKey: amina },
      ]),
    );
  });

  it('[H5P-005] deletes all state of an activity and treats non-UUID content IDs as not found', async () => {
    // Arrange
    const [gone, kept] = [await fx.newContent(), await fx.newContent()];
    const amina = newLearner();
    await Promise.all([fx.save(gone, amina), fx.save(kept, amina)]);
    // Act
    await fx.storage.deleteAllContentUserDataByContentId(gone);
    // Assert
    expect(await fx.stateOf(gone, amina)).toBeNull();
    expect(await fx.stateOf(kept, amina)).not.toBeNull();

    // Act and assert: a non-UUID or missing content ID finds, deletes and stores nothing.
    await fx.save('not-a-uuid', amina);
    expect(await fx.stateOf('not-a-uuid', amina)).toBeNull();
    expect(await fx.storage.getContentUserDataByContentIdAndUser("1' OR '1'='1", amina)).toEqual([]);
    await fx.storage.deleteAllContentUserDataByContentId('../all');
    await fx.storage.deleteInvalidatedContentUserData('*');
    expect(await fx.db.h5PUserData.count({ where: { learnerKey: amina } })).toBe(1);
    const withoutContent = { dataType: 'state', subContentId: '0', userId: amina, userState: '{}' };
    await expect(
      fx.storage.createOrUpdateContentUserData({ ...withoutContent, preload: true, invalidate: false }),
    ).rejects.toThrow(TypeError);
  });

  it('[H5P-005] the stored key is exactly the pseudonym it was given', async () => {
    // Arrange: amina's learnerKey is the pseudonym of a raw LTI subject.
    const content = await fx.newContent();
    const subject = randomUUID();
    const amina = learnerKeyOf(subject);
    const bjorn = newLearner();
    expect(amina).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Act
    await fx.save(content, amina, { contextId: 'canvas-course-101' });
    await fx.save(content, bjorn);
    // Assert: the row holds the pseudonym, never the subject or the issuer.
    const rows = await fx.db.h5PUserData.findMany({ where: { contentId: content, learnerKey: amina } });
    expect(rows.map((row) => row.learnerKey)).toEqual([amina]);
    expect(JSON.stringify(rows)).not.toContain(subject);
    expect(JSON.stringify(rows)).not.toContain(ISSUER);

    // Act and assert: reading and deleting by learner touch only that learner's state.
    const ofAmina = await fx.storage.getContentUserDataByUser(stateUser(amina));
    expect(ofAmina.map((s) => [s.userId, s.contextId])).toEqual([[amina, 'canvas-course-101']]);
    await fx.storage.deleteAllContentUserDataByUser(stateUser(amina));
    expect(await fx.storage.getContentUserDataByUser(stateUser(amina))).toEqual([]);
    expect(await fx.storage.getContentUserDataByUser(stateUser(bjorn))).toHaveLength(1);
  });

  it('[H5P-005] refuses IDs that are not pseudonyms and never matches every learner', async () => {
    // Arrange
    const content = await fx.newContent();
    const amina = newLearner();
    await fx.save(content, amina);
    // Act and assert: raw or missing learner IDs are refused and match no learner.
    const rawIds = [randomUUID(), 'amina@stud.hvl.no', 'amina@hvl.no', '01019912345', '', undefined];
    for (const userId of rawIds) {
      await expect(fx.save(content, userId as string)).rejects.toThrow(TypeError);
    }
    const noId = { ...stateUser(amina), id: undefined } as unknown as IUser;
    expect(await fx.storage.getContentUserDataByUser(noId)).toEqual([]);
    await fx.storage.deleteAllContentUserDataByUser(noId);
    await fx.storage.deleteAllContentUserDataByUser(stateUser(''));
    expect(
      await fx.storage.getContentUserDataByContentIdAndUser(content, undefined as unknown as string),
    ).toEqual([]);
    expect(await fx.stateOf(content, 'amina@stud.hvl.no')).toBeNull();
    expect(await fx.db.h5PUserData.count({ where: { contentId: content } })).toBe(1);

    // Act and assert: a state that is not a string or has no data type is refused; the stored one is kept.
    const notAString = { userState: { page: 2 } as unknown as string };
    await expect(fx.save(content, amina, notAString)).rejects.toThrow(TypeError);
    await expect(fx.save(content, amina, { dataType: '' })).rejects.toThrow(TypeError);
    expect((await fx.stateOf(content, amina))?.userState).toBe('{"page":1}');
  });

  it('[H5P-005] never stores finished data (D-037)', async () => {
    const content = await fx.newContent();
    const amina = newLearner();
    const finished = { score: 3, maxScore: 4, openedTimestamp: 1, finishedTimestamp: 2, completionTime: 1 };
    await fx.storage.createOrUpdateFinishedData({ contentId: content, userId: amina, ...finished });
    expect(await fx.storage.getFinishedDataByContentId(content)).toEqual([]);
    expect(await fx.storage.getFinishedDataByUser(stateUser(amina))).toEqual([]);
    await expect(fx.storage.deleteFinishedDataByContentId(content)).resolves.toBeUndefined();
    await expect(fx.storage.deleteFinishedDataByUser(stateUser(amina))).resolves.toBeUndefined();
    expect(await fx.db.h5PUserData.count({ where: { learnerKey: amina } })).toBe(0);
  });
});
