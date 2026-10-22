/**
 * Integration tests for saving and resuming learner state on PostgreSQL, keyed by the learner pseudonym.
 *
 * Spec: H5P-005, PROD-008
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  ContentUserDataManager,
  UserDataPermission,
  type IContentUserData,
  type IPermissionSystem,
} from '@lumieducation/h5p-server';
import { createH5pStorage } from '../../src/h5p/h5pStorage.js';
import { connectRedis } from '../../src/infra/redisClient.js';
import { createS3Client } from '../../src/infra/s3Client.js';
import {
  SUB_A,
  SUB_B,
  newLearner,
  openLearnerStateFixture,
  stateUser,
  type LearnerStateFixture,
} from '../support/learnerStateFixtures.js';
import { describeWithServices, serviceEnv } from '../support/services.js';

// WHY: a stand-in for HvlPermissionSystem that lets a user read and write only their own state, so this
// file tests the storage through Lumi's real manager without depending on the permission module.
const ownStateOnly: IPermissionSystem = {
  checkForUserData: async (user, permission, _contentId, affectedUserId) =>
    affectedUserId === user.id &&
    [UserDataPermission.EditState, UserDataPermission.ViewState].includes(permission),
  checkForContent: async () => false,
  checkForGeneralAction: async () => false,
  checkForTemporaryFile: async () => false,
};

describeWithServices('[H5P-005] learner state on PostgreSQL: saving and resuming', () => {
  let fx: LearnerStateFixture;

  beforeAll(async () => {
    fx = await openLearnerStateFixture();
  });

  afterAll(() => fx.close());

  it('[H5P-005] stores and returns state per content, sub-content, data type, learner and context', async () => {
    const [first, second] = [await fx.newContent(), await fx.newContent()];
    const [amina, bjorn] = [newLearner(), newLearner()];
    await fx.save(first, amina, { userState: '{"page":2}' });
    await fx.save(first, amina, { subContentId: SUB_A, userState: '{"answer":"B"}', preload: false });
    await fx.save(first, amina, { dataType: 'notes', userState: '"note"' });
    await fx.save(first, bjorn, { userState: '{"page":7}' });
    await fx.save(second, amina, { userState: '{"page":9}' });
    expect(await fx.stateOf(first, amina)).toEqual({
      ...{ contentId: first, subContentId: '0', dataType: 'state', userId: amina },
      ...{ userState: '{"page":2}', preload: true, invalidate: true },
    });
    expect((await fx.stateOf(first, amina, undefined, SUB_A))?.userState).toBe('{"answer":"B"}');
    expect((await fx.storage.getContentUserData(first, 'notes', '0', amina)).userState).toBe('"note"');
    expect((await fx.stateOf(first, bjorn))?.userState).toBe('{"page":7}');
    expect((await fx.stateOf(second, amina))?.userState).toBe('{"page":9}');

    await fx.save(first, amina, { userState: '{"page":3}', invalidate: false });
    expect(await fx.stateOf(first, amina)).toMatchObject({ userState: '{"page":3}', invalidate: false });
    expect(await fx.db.h5PUserData.count({ where: { contentId: first } })).toBe(4);
  });

  it('[H5P-005][PROD-008] keeps separate state for the same learner in another course context', async () => {
    const content = await fx.newContent();
    const amina = newLearner();
    await fx.save(content, amina, { contextId: 'canvas-course-101', userState: '{"page":1}' });
    await fx.save(content, amina, { contextId: 'canvas-course-202', userState: '{"page":5}' });
    await fx.save(content, amina, { userState: '{"page":8}' });
    expect((await fx.stateOf(content, amina, 'canvas-course-101'))?.userState).toBe('{"page":1}');
    expect((await fx.stateOf(content, amina, 'canvas-course-202'))?.userState).toBe('{"page":5}');
    expect((await fx.stateOf(content, amina))?.userState).toBe('{"page":8}');
    expect(await fx.stateOf(content, amina, 'canvas-course-303')).toBeNull();

    const inCourse = await fx.storage.getContentUserDataByContentIdAndUser(
      content,
      amina,
      'canvas-course-202',
    );
    expect(inCourse.map((s) => [s.contextId, s.userState])).toEqual([['canvas-course-202', '{"page":5}']]);
    const outside = await fx.storage.getContentUserDataByContentIdAndUser(content, amina);
    expect(outside).toHaveLength(1);
    expect(outside[0]).not.toHaveProperty('contextId');
    expect(outside[0]?.userState).toBe('{"page":8}');
  });

  it('[H5P-005] returns null when nothing is stored and lists the main state first', async () => {
    const content = await fx.newContent();
    const amina = newLearner();
    expect(await fx.stateOf(content, amina)).toBeNull();
    expect(await fx.storage.getContentUserDataByContentIdAndUser(content, amina)).toEqual([]);
    // WHY: sub-content is saved first, so insertion order alone would list it before the main state.
    await fx.save(content, amina, { subContentId: SUB_B, userState: '{"sub":2}' });
    await fx.save(content, amina, { subContentId: SUB_A, userState: '{"sub":1}' });
    await fx.save(content, amina, { userState: '{"main":true}' });
    const listed = await fx.storage.getContentUserDataByContentIdAndUser(content, amina);
    expect(listed.map((s) => s.subContentId)).toEqual(['0', SUB_A, SUB_B]);
    expect(listed[0]?.userState).toBe('{"main":true}');
  });

  it('[H5P-005][PROD-008] after a reload the player gets the saved state through Lumi, main state first', async () => {
    const lumi = new ContentUserDataManager(fx.storage, ownStateOnly);
    const content = await fx.newContent();
    const amina = stateUser(newLearner());
    const post = (sub: string, data: string, contextId?: string) =>
      lumi.createOrUpdateContentUserData(content, 'state', sub, data, true, true, amina, contextId);
    await post(SUB_A, '{"answer":"B"}', 'canvas-course-101');
    await post('0', '{"page":4}', 'canvas-course-101');
    await post('0', '{"page":1}', 'canvas-course-202');

    // WHY: this is what the player puts in H5PIntegration.contents[cid].contentUserData; h5p.js reads
    // the main state at index 0, and Lumi's own sort leaves UUID sub-content where storage put it.
    const reload = (contextId?: string) => lumi.generateContentUserDataIntegration(content, amina, contextId);
    expect(await reload('canvas-course-101')).toEqual([{ state: '{"page":4}' }, { state: '{"answer":"B"}' }]);
    expect(await reload('canvas-course-202')).toEqual([{ state: '{"page":1}' }]);
    expect(await reload()).toEqual([]);

    // WHY: "start over" in h5p.js (H5P.deleteUserData) posts data=0 as a form value.
    await post('0', '0', 'canvas-course-101');
    expect(await lumi.getContentUserData(content, 'state', '0', amina, 'canvas-course-101')).toBeNull();
    expect(await reload('canvas-course-202')).toEqual([{ state: '{"page":1}' }]);
  });

  it('[H5P-005] the production storage set keeps learner state in PostgreSQL as a JSON string', async () => {
    const env = serviceEnv();
    const redis = await connectRedis(env.REDIS_URL);
    const s3 = createS3Client(env);
    const libraryDir = mkdtempSync(join(tmpdir(), 'h5p-libs-'));
    try {
      const { contentUserDataStorage } = createH5pStorage({ env, db: fx.db, redis, s3, libraryDir });
      const content = await fx.newContent();
      const amina = newLearner();
      const state: IContentUserData = {
        ...{ contentId: content, userId: amina, dataType: 'state', subContentId: '0' },
        ...{ userState: '{"page":6}', preload: true, invalidate: true },
      };
      await contentUserDataStorage.createOrUpdateContentUserData(state);
      const rows = await fx.db.h5PUserData.findMany({ where: { contentId: content } });
      expect(rows.map((r) => [r.learnerKey, r.contextId, r.data])).toEqual([[amina, '', '{"page":6}']]);
    } finally {
      await redis.quit();
      s3.destroy();
      rmSync(libraryDir, { recursive: true, force: true });
    }
  });
});
