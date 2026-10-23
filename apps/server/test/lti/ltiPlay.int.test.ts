/**
 * Integration tests for the LTI player across courses: one activity placed in two Canvas courses keeps separate
 * placements and separate learner state, and a teacher of a copied course may play it but not edit it.
 *
 * Spec: LTI-007, LTI-006, DATA-002, H5P-006
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type CanvasUser } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[LTI-007] one activity in several Canvas courses', () => {
  let tb: AppTestbed;
  let published: string;
  const student: CanvasUser = { sub: `student-${randomUUID()}`, roles: CANVAS_USERS.student.roles };
  beforeAll(async () => {
    tb = await openAppTestbed();
    published = await tb.activity(await tb.staffAccount(), { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  const launchIn = async (course: string, user: CanvasUser = student) =>
    (
      await launchFromCanvas(tb.app, tb.mock.canvas, {
        user,
        course: { id: course },
        resourceLinkId: `link-in-${course}`,
        custom: { contentId: published },
      })
    ).ltik ?? '';
  const statePath = (ltik: string) =>
    `/h5p/contentUserData/${published}/state/0?ltik=${encodeURIComponent(ltik)}`;

  it('[LTI-007] each course gets its own placement of the same activity', async () => {
    // Act
    await launchIn('course-a');
    await launchIn('course-b');
    // Assert
    const placements = await tb.db.ltiPlacement.findMany({
      where: { platformId: tb.platformId, contentId: published },
      select: { resourceLinkId: true },
    });
    expect(placements.map((p) => p.resourceLinkId).sort()).toEqual(['link-in-course-a', 'link-in-course-b']);
  });

  it('[LTI-007] a learner’s state in one course is not shown in another', async () => {
    // Arrange
    const inA = await launchIn('course-a');
    const inB = await launchIn('course-b');
    // Act
    await request(tb.app)
      .post(statePath(inA))
      .type('form')
      .send({ data: '{"answers":[1]}', preload: '1', invalidate: '1' });
    const fromA = await request(tb.app).get(statePath(inA));
    const fromB = await request(tb.app).get(statePath(inB));
    // Assert
    expect(fromA.body.data).toBe('{"answers":[1]}');
    expect(fromB.body.data).toBe(false);
  });

  it('[LTI-007] a teacher of a copied course plays the activity but cannot edit it', async () => {
    // Arrange: a teacher who neither owns nor co-authors the activity
    const teacher: CanvasUser = { sub: `teacher-${randomUUID()}`, roles: CANVAS_USERS.teacher.roles };
    const ltik = await launchIn('course-copy', teacher);
    // Act
    const play = await request(tb.app).get(`/lti/play?ltik=${encodeURIComponent(ltik)}`);
    const edit = await request(tb.app)
      .put(`/h5p/content/${published}`)
      .set('Authorization', `Bearer ${ltik}`)
      .send({
        library: 'H5P.MultiChoice 1.16',
        params: { params: { question: 'Ny?' }, metadata: { title: 'Ny', license: 'U' } },
      });
    // Assert
    expect(play.status).toBe(200);
    expect(edit.status).toBe(403);
  });
});
