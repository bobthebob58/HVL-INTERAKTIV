/**
 * Integration test of the NRPS learner count as the app wires it (LTI-008): a learner's resource-link launch from the
 * mock Canvas, through `createApp` with the counter main.ts passes, stores the course's active learners under D-103's
 * key after the redirect; a bed without the counter stores nothing.
 *
 * Spec: LTI-008, INS-001
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { LTI_ROLE } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import {
  NRPS_COUNT_KEY_PREFIX,
  NRPS_FRESH_KEY_PREFIX,
  NrpsLearnerCountStore,
} from '../../../src/lti/nrps/NrpsLearnerCountStore.js';
import { platformContextKey } from '../../../src/xapi/platformContextKey.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

describeWithServices('[LTI-008] the NRPS count after a launch, as the app wires it', () => {
  let tb: AppTestbed;
  let activity: string;
  const keys: string[] = [];
  beforeAll(async () => {
    tb = await openAppTestbed(undefined, { nrps: true });
    activity = await tb.activity(await tb.staffAccount(), { published: true });
  }, 60_000);
  afterAll(async () => {
    if (keys.length > 0) await tb.redis.del(keys);
    await tb.close();
  });

  /** Gives a new course a roster of `learners` active learners and one teacher, and returns its D-103 key. */
  const course = (learners: number) => {
    const courseId = `launch-nrps-${randomUUID()}`;
    const members = Array.from({ length: learners }, () => ({
      user_id: randomUUID(),
      roles: [LTI_ROLE.learner],
    }));
    tb.mock.canvas.nrps.setMembers(courseId, [
      ...members,
      { user_id: randomUUID(), roles: [LTI_ROLE.instructor] },
    ]);
    const key = platformContextKey(tb.platformId, courseId);
    keys.push(`${NRPS_COUNT_KEY_PREFIX}${key}`, `${NRPS_FRESH_KEY_PREFIX}${key}`);
    return { courseId, key };
  };

  it('[LTI-008] a learner’s launch counts the course’s active learners in the background and keeps only the number', async () => {
    // Arrange
    const { courseId, key } = course(7);
    const store = new NrpsLearnerCountStore(tb.redis);
    // Act
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      custom: { contentId: activity },
      resourceLinkId: `nrps-${randomUUID()}`,
      course: { id: courseId },
    });
    // Assert: the launch answered first; the count follows. WHY: 8, since the mock Canvas enrols the launching
    // student beside the 7 learners set; the teacher is no learner.
    expect(run.ltik).toBeTruthy();
    await expect.poll(async () => (await store.read(key))?.count, { timeout: 10_000 }).toBe(8);
    const stored = await tb.redis.get(`${NRPS_COUNT_KEY_PREFIX}${key}`);
    expect(stored).not.toMatch(/user_id|[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('[LTI-008] the app without a counter (a bed that does not ask for one) stores no count', async () => {
    // Arrange
    const plain = await openAppTestbed();
    const content = await plain.activity(await plain.staffAccount(), { published: true });
    const courseId = `launch-nrps-${randomUUID()}`;
    plain.mock.canvas.nrps.setMembers(courseId, [{ user_id: randomUUID(), roles: [LTI_ROLE.learner] }]);
    const key = platformContextKey(plain.platformId, courseId);
    try {
      // Act
      const run = await launchFromCanvas(plain.app, plain.mock.canvas, {
        custom: { contentId: content },
        resourceLinkId: `nrps-${randomUUID()}`,
        course: { id: courseId },
      });
      // Assert
      expect(run.ltik).toBeTruthy();
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await plain.redis.exists(`${NRPS_COUNT_KEY_PREFIX}${key}`)).toBe(0);
    } finally {
      await plain.close();
    }
  }, 60_000);
});
