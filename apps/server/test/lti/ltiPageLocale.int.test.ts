/**
 * Integration tests for the language of LTI refusals through the whole app: a launch handler's refusal, a refusal on
 * the picker page and a refused picker answer are shown in the language of the launch, not in the default.
 *
 * Spec: PROD-012, PROD-004, LTI-005
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type CanvasUser } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { t } from '../../src/i18n/translate.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[PROD-012] the language of LTI refusals', () => {
  let tb: AppTestbed;
  let draft: string;
  let published: string;
  const teacher: CanvasUser = { sub: `teacher-${randomUUID()}`, roles: CANVAS_USERS.teacher.roles };
  beforeAll(async () => {
    tb = await openAppTestbed();
    const owner = await tb.staffAccount();
    draft = await tb.activity(owner);
    published = await tb.activity(owner, { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  it('[PROD-012][PROD-004] an English launch of a draft gets the 404 page in English', async () => {
    // Act
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user: { sub: `student-${randomUUID()}`, roles: CANVAS_USERS.student.roles },
      locale: 'en-GB',
      custom: { contentId: draft },
    });
    // Assert
    expect(run.res.status).toBe(404);
    expect(run.res.text).toContain('<html lang="en">');
    expect(run.res.text).toContain(`<h1>${t('page.notAvailable.title', {}, 'en')}</h1>`);
  });

  it('[PROD-012][LTI-005] the picker refuses a resource-link ltik in the launch’s language', async () => {
    // Arrange: a teacher's ordinary launch, not a Deep Linking request
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user: teacher,
      locale: 'en',
      custom: { contentId: published },
    });
    // Act
    const res = await request(tb.app).get(`/lti/deeplink?ltik=${encodeURIComponent(run.ltik ?? '')}`);
    // Assert
    expect(res.status).toBe(403);
    expect(res.text).toContain('<html lang="en">');
  });

  it('[PROD-012][LTI-005] a malformed picker answer is refused with an English message after an English launch', async () => {
    // Arrange
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: teacher,
      locale: 'en',
    });
    // Act
    const res = await request(tb.app)
      .post('/lti/deeplink/response')
      .set('Authorization', `Bearer ${run.ltik ?? ''}`)
      .set('Accept', 'application/json')
      .send({ contentIds: 'not-a-list' });
    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(t('error.badRequest', {}, 'en'));
  });
});
