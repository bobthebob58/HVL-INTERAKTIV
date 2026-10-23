/**
 * Integration test for the formative-use notice on the server-rendered Deep Linking picker: shown until the teacher
 * dismisses its current version with the launch's ltik, then gone on the next launch.
 *
 * Spec: PROD-011, LTI-005
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

describeWithServices('[PROD-011] the picker’s formative-use notice', () => {
  let tb: AppTestbed;
  const teacher = { sub: `teacher-${randomUUID()}`, roles: CANVAS_USERS.teacher.roles };
  beforeAll(async () => {
    tb = await openAppTestbed();
  }, 60_000);
  afterAll(() => tb?.close());

  const pickerLtik = async () =>
    (await launchFromCanvas(tb.app, tb.mock.canvas, { messageType: 'LtiDeepLinkingRequest', user: teacher }))
      .ltik ?? '';

  it('[PROD-011] the picker shows the notice until the teacher dismisses it with the ltik', async () => {
    // Arrange
    const ltik = await pickerLtik();
    const before = await request(tb.app).get(`/lti/deeplink?ltik=${encodeURIComponent(ltik)}`);
    // Act: what the page script sends
    const dismissed = await request(tb.app)
      .put('/api/me/notices/formative-use')
      .set('Authorization', `Bearer ${ltik}`)
      .send({ version: 1 });
    const after = await request(tb.app).get(`/lti/deeplink?ltik=${encodeURIComponent(await pickerLtik())}`);
    // Assert
    expect(before.text).toContain('id="formative-notice"');
    expect(dismissed.status).toBe(204);
    expect(after.text).not.toContain('id="formative-notice"');
  });
});
