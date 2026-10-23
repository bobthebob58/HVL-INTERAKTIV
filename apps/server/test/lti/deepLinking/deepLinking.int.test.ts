/**
 * Integration tests for Deep Linking from the mock Canvas through the whole app: the launch, the picker page, the
 * signed answer (checked by the mock Canvas like Canvas checks it) and the refusals.
 *
 * Spec: LTI-005, PROD-005, LTI-003, LTI-004
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CANVAS_USERS,
  type CanvasUser,
  type LaunchSpec,
} from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

const newTeacher = (): CanvasUser => ({ sub: `teacher-${randomUUID()}`, roles: CANVAS_USERS.teacher.roles });

describeWithServices('LTI Deep Linking', () => {
  let tb: AppTestbed;
  let teacher: CanvasUser;
  let teacherId: string;
  let own: { published: string; second: string; draft: string };
  let coAuthored: string;
  let foreign: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    teacher = newTeacher();
    const first = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: teacher,
    });
    teacherId = (await tb.lti.resolveLtik(first.ltik ?? '')).principal.userId;
    own = {
      published: await tb.activity(teacherId, { published: true }),
      second: await tb.activity(teacherId, { published: true, title: 'Brøkar 2' }),
      draft: await tb.activity(teacherId, { title: 'Utkast' }),
    };
    // WHY: H5P cleans titles on save; a stored title with markup proves the page escapes it on its own.
    await tb.db.h5PContent.update({ where: { id: own.published }, data: { title: 'Brøkar <b>1</b>' } });
    const colleague = await tb.staffAccount();
    coAuthored = await tb.activity(colleague, { published: true, title: 'Felles' });
    await tb.db.contentCollaborator.create({ data: { contentId: coAuthored, userId: teacherId } });
    foreign = await tb.activity(colleague, { published: true, title: 'Andre sin' });
  }, 60_000);
  afterAll(() => tb.close());

  const deepLink = async (spec: LaunchSpec = {}) => {
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: teacher,
      placement: 'assignment_selection',
      ...spec,
    });
    return run.ltik ?? '';
  };
  const answer = (ltik: string, contentIds: string[]) =>
    request(tb.app)
      .post('/lti/deeplink/response')
      .set('Authorization', `Bearer ${ltik}`)
      .set('Accept', 'application/json')
      .send({ contentIds });

  describe('the picker', () => {
    it('[LTI-005] a teacher’s Deep Linking launch opens the picker with an ltik', async () => {
      const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
        messageType: 'LtiDeepLinkingRequest',
        user: teacher,
      });
      expect(run.path).toBe('/lti/deeplink');
      expect(run.ltik).toBeTruthy();
    });

    it('[PROD-005] the picker lists own and co-authored activities, drafts disabled, nobody else’s', async () => {
      // Act
      const res = await request(tb.app).get(`/lti/deeplink?ltik=${encodeURIComponent(await deepLink())}`);
      // Assert
      expect(res.status).toBe(200);
      expect(res.text).toContain(`value="${own.published}"`);
      expect(res.text).toContain('Brøkar &lt;b&gt;1&lt;/b&gt;');
      expect(res.text).toContain(`value="${coAuthored}"`);
      expect(res.text).toMatch(new RegExp(`value="${own.draft}" disabled aria-describedby=`));
      expect(res.text).not.toContain(foreign);
      expect(res.text).toContain('type="radio"');
    });

    it('[LTI-003] the picker may post forms only to us and to Canvas, and is framed only by Canvas', async () => {
      const res = await request(tb.app).get(`/lti/deeplink?ltik=${encodeURIComponent(await deepLink())}`);
      const csp = String(res.headers['content-security-policy']);
      expect(csp).toContain(`form-action 'self' ${tb.mock.canvas.origin}`);
      expect(csp).toContain(`frame-ancestors ${tb.mock.canvas.origin}`);
      expect(csp).toContain("script-src 'self'");
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('[LTI-005] checkboxes appear only when the platform accepts several items', async () => {
      const ltik = await deepLink({ placement: 'link_selection', acceptMultiple: true });
      const res = await request(tb.app).get(`/lti/deeplink?ltik=${encodeURIComponent(ltik)}`);
      expect(res.text).toContain('type="checkbox"');
    });
  });

  describe('the signed answer', () => {
    it('[LTI-005] Canvas accepts the signed answer for a graded placement, with a line item', async () => {
      // Arrange
      const ltik = await deepLink({ placement: 'assignment_selection' });
      // Act
      const res = await answer(ltik, [own.published]);
      const record = await tb.mock.canvas.verifyDeepLinkResponse(String(res.body.jwt));
      // Assert
      expect(res.status).toBe(200);
      expect(res.body.returnUrl).toMatch(new RegExp(`^${tb.mock.canvas.origin}/`));
      expect(record.problems).toEqual([]);
      expect(record.lifetime).toBeLessThanOrEqual(60);
      expect(record.items).toEqual([
        expect.objectContaining({
          type: 'ltiResourceLink',
          url: `${tb.toolUrl}/lti/launch`,
          custom: { contentId: own.published },
          lineItem: expect.objectContaining({ scoreMaximum: 100, resourceId: own.published }),
        }),
      ]);
    });

    it('[PROD-005] a link placement returns several items without a line item', async () => {
      // Arrange
      const ltik = await deepLink({ placement: 'link_selection', acceptMultiple: true });
      // Act
      const res = await answer(ltik, [own.published, coAuthored]);
      const record = await tb.mock.canvas.verifyDeepLinkResponse(String(res.body.jwt));
      // Assert
      expect(record.problems).toEqual([]);
      expect(record.items.map((item) => (item.custom as { contentId: string }).contentId)).toEqual([
        own.published,
        coAuthored,
      ]);
      expect(record.items.every((item) => item.lineItem === undefined)).toBe(true);
    });

    it('[LTI-005] several activities are refused when the platform accepts only one', async () => {
      const res = await answer(await deepLink({ acceptMultiple: false }), [own.published, own.second]);
      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('hvl:deep-link-choice-invalid');
    });

    it('[LTI-005] a draft is refused with 409 and someone else’s activity with 404', async () => {
      const ltik = await deepLink();
      expect((await answer(ltik, [own.draft])).status).toBe(409);
      expect((await answer(ltik, [foreign])).status).toBe(404);
    });
  });

  describe('who may use it', () => {
    it('[LTI-004] a learner’s Deep Linking launch is refused before any picker or ltik', async () => {
      const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
        messageType: 'LtiDeepLinkingRequest',
        user: CANVAS_USERS.student,
      });
      expect(run.res.status).toBe(403);
      expect(run.ltik).toBeUndefined();
    });

    it('[LTI-005] the ltik of a resource-link launch cannot open the picker or get anything signed', async () => {
      // Arrange
      const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
        user: teacher,
        custom: { contentId: own.published },
      });
      // Act
      const page = await request(tb.app).get(`/lti/deeplink?ltik=${encodeURIComponent(run.ltik ?? '')}`);
      const signed = await answer(run.ltik ?? '', [own.published]);
      // Assert
      expect(page.status).toBe(403);
      expect(signed.status).toBe(403);
    });

    it('[LTI-003] the answer API takes the ltik only as a Bearer token', async () => {
      const ltik = await deepLink();
      const res = await request(tb.app)
        .post(`/lti/deeplink/response?ltik=${encodeURIComponent(ltik)}`)
        .set('Accept', 'application/json')
        .send({ contentIds: [own.published] });
      expect(res.status).toBe(401);
    });
  });
});
