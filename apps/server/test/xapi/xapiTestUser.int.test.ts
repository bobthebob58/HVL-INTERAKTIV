/**
 * Integration tests of Canvas's Student View test student through the whole app and the mock Canvas (D-102's
 * amendment of 2026-11-04): its launch is a learner whose launch facts say `testUser`; its statements are stored
 * flagged, so the grade bridge still queues its score and the worker sends it to the mock Canvas, for the teacher to
 * check in Canvas; and insight never counts it, so test students cannot make up the *k* that would show a real
 * learner's answers.
 *
 * Spec: LTI-011, DATA-012, LTI-012, INS-006, LTI-004
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { GRADE_SYNC_LEASE_KEY, GradeSyncWorker } from '../../src/grades/GradeSyncWorker.js';
import { LTI_TEST_USER_ROLE } from '../../src/lti/LtiRoleMapper.js';
import { DataEncryption } from '../../src/security/keys/DataEncryption.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { capturedLogger } from '../support/capturedLogger.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';
import { moveStatementsToYesterday } from '../support/statementsToYesterday.js';
import { fixturePlay } from './support/xapiBridgeItems.js';

/**
 * The grade worker as main.ts builds it, for one `runOnce(now)` over the given placements only.
 * @param tb - The test bed.
 * @param placementIds - The placements whose jobs it may send.
 * @returns The worker; it is never started, so it holds no timer.
 */
function gradeWorkerOf(tb: AppTestbed, placementIds: readonly string[]): GradeSyncWorker {
  return new GradeSyncWorker({
    db: tb.db,
    redis: tb.redis,
    logger: capturedLogger('debug').logger,
    encryption: new DataEncryption(tb.env.DATA_ENCRYPTION_KEYS),
    platforms: tb.lti.provider.platformManager,
    lineItemRules: { origins: tb.env.CANVAS_ORIGINS, requireHttps: tb.env.NODE_ENV === 'production' },
    placementIds,
  });
}

/** Canvas's Student View: the student's roles plus the LTI `TestUser` system role (D-059). */
const TEST_STUDENT_ROLES = [...CANVAS_USERS.student.roles, LTI_TEST_USER_ROLE];

describeWithServices(
  '[LTI-011] Canvas’s test student (Student View) is stored flagged and never counted',
  () => {
    let tb: AppTestbed;
    let contentId: string;
    const course = { id: `test-student-${randomUUID()}`, label: 'TEST101' };
    beforeAll(async () => {
      tb = await openAppTestbed();
      const owner = await tb.staffAccount();
      contentId = await tb.activity(owner, { published: true });
    }, 60_000);
    afterAll(() => tb?.close());

    /** Launches a new Canvas user into the course's graded link. */
    async function launch(roles: readonly string[]) {
      const sub = randomUUID();
      const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, {
        custom: { contentId },
        user: { sub, roles },
        course,
        resourceLinkId: 'graded-link',
        lineItem: 'graded-line-item',
      });
      if (!ltik) throw new Error('the launch did not reach the tool');
      return { sub, ltik, principal: (await tb.lti.resolveLtik(ltik)).principal };
    }
    /** One MultiChoice page load, as the bridge sends it, with the launch's Bearer ltik. */
    const play = (ltik: string) =>
      request(tb.app)
        .post('/api/h5p/xapi')
        .set('Authorization', `Bearer ${ltik}`)
        .send({
          contentId,
          contentVersion: 1,
          statements:
            fixturePlay('H5P.MultiChoice', contentId, { bridgeOnly: true }).views[0]?.statements ?? [],
        });
    const rowsOf = (learnerKey: string) =>
      tb.db.xapiStatement.findMany({
        where: { contentId, learnerKey },
        select: { verb: true, testUser: true },
      });

    it('[DATA-012] stores the test student’s statements flagged and a real learner’s unflagged, both as learners', async () => {
      // Arrange
      const tester = await launch(TEST_STUDENT_ROLES);
      const student = await launch(CANVAS_USERS.student.roles);
      // Act
      const statuses = [(await play(tester.ltik)).status, (await play(student.ltik)).status];
      // Assert
      expect(statuses).toEqual([202, 202]);
      expect([tester.principal.roles, student.principal.roles]).toEqual([['learner'], ['learner']]);
      expect(tester.principal.lti?.testUser).toBe(true);
      expect(student.principal.lti).not.toHaveProperty('testUser');
      const [flagged, real] = [
        await rowsOf(tester.principal.learnerKey),
        await rowsOf(student.principal.learnerKey),
      ];
      expect(flagged.map((row) => row.verb)).toEqual(['attempted', 'answered']);
      expect(flagged.every((row) => row.testUser)).toBe(true);
      expect(real.length).toBe(2);
      expect(real.some((row) => row.testUser)).toBe(false);
    });

    it('[LTI-012] still sends the test student’s score to Canvas, so a teacher can test the passback', async () => {
      // Arrange
      const tester = await launch(TEST_STUDENT_ROLES);
      // Act
      await play(tester.ltik);
      const jobs = await tb.db.gradeSyncJob.findMany({
        where: { learnerKey: tester.principal.learnerKey, placement: { contentId } },
        select: { status: true, placement: { select: { id: true, lineItemUrl: true } } },
      });
      const placement = jobs[0]?.placement;
      // WHY: another test's worker may still hold the one-node lease; this worker sends only this placement's jobs.
      await tb.redis.del(GRADE_SYNC_LEASE_KEY);
      const outcome = await gradeWorkerOf(tb, [placement?.id ?? '']).runOnce(new Date());
      // Assert: queued, then sent by the worker main.ts builds, and received by the mock Canvas for the tester's sub
      expect(jobs.map((job) => job.status)).toEqual(['pending']);
      expect(outcome).toBe('ran');
      const received = tb.mock.canvas.ags.scores.filter(
        (s) => s.lineItemUrl === placement?.lineItemUrl && s.score.userId === tester.sub,
      );
      expect(received.map((s) => [s.score.scoreMaximum, s.score.gradingProgress])).toEqual([
        [100, 'FullyGraded'],
      ]);
      const [sent] = await tb.db.gradeSyncJob.findMany({
        where: { learnerKey: tester.principal.learnerKey },
        select: { status: true },
      });
      expect(sent).toEqual({ status: 'succeeded' });
    });

    it('[INS-006] test students never make up k: four learners and two test students stay «< 5»; a fifth learner shows 5', async () => {
      // Arrange: a fresh course, so the rows above are not in it
      course.id = `test-student-k-${randomUUID()}`;
      const roleSets: (readonly string[])[] = [TEST_STUDENT_ROLES, TEST_STUDENT_ROLES];
      roleSets.push(...Array.from({ length: 4 }, () => CANVAS_USERS.student.roles));
      /** Plays as new users and moves their rows to yesterday, which the view holds (D-106's amendment). */
      const playedYesterday = async (sets: (readonly string[])[]) => {
        const keys: string[] = [];
        for (const roles of sets) {
          const learner = await launch(roles);
          expect((await play(learner.ltik)).status).toBe(202);
          keys.push(learner.principal.learnerKey);
        }
        await moveStatementsToYesterday(tb.db, contentId, keys);
      };
      const teacher = await launch(CANVAS_USERS.teacher.roles);
      const view = async () => {
        const res = await request(tb.app)
          .get(`/api/content/${contentId}/insight`)
          .set('Authorization', `Bearer ${teacher.ltik}`);
        return [res.status, res.body.participation?.started];
      };
      // Act
      await playedYesterday(roleSets);
      const withFour = await view();
      await playedYesterday([CANVAS_USERS.student.roles]);
      const withFive = await view();
      // Assert
      expect(withFour).toEqual([200, { suppressed: true }]);
      expect(withFive).toEqual([200, { suppressed: false, value: 5 }]);
    });
  },
);
