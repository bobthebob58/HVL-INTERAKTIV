/**
 * Integration tests for the formative label in a signed Deep Linking answer, checked by the mock Canvas as Canvas
 * checks it: «Tittel (formativ)» through the app as it runs (the default mode), and Canvas's keep-the-name extension
 * with a description in the launch's language when the routes get `AGS_LABEL_MODE=preserve` (D-105).
 *
 * Spec: LTI-013, LTI-005
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { deepLinkRoutes } from '../../../src/lti/deepLinking/deepLinkRoutes.js';
import { PRESERVE_NAME_EXTENSION } from '../../../src/lti/deepLinking/formativeLabel.js';
import { t } from '../../../src/i18n/translate.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

describeWithServices('[LTI-013] the formative label in the signed Deep Linking answer', () => {
  let tb: AppTestbed;
  let activity: string;
  const teacher = { sub: `teacher-${randomUUID()}`, roles: CANVAS_USERS.teacher.roles };
  const graded = async (spec: LaunchSpec = {}) =>
    (
      await launchFromCanvas(tb.app, tb.mock.canvas, {
        messageType: 'LtiDeepLinkingRequest',
        user: teacher,
        placement: 'assignment_selection',
        ...spec,
      })
    ).ltik ?? '';
  const answer = (app: express.Express, ltik: string) =>
    request(app)
      .post('/lti/deeplink/response')
      .set('Authorization', `Bearer ${ltik}`)
      .set('Accept', 'application/json')
      .send({ contentIds: [activity] });

  beforeAll(async () => {
    tb = await openAppTestbed();
    const teacherId = (await tb.lti.resolveLtik(await graded())).principal.userId;
    activity = await tb.activity(teacherId, { published: true, title: 'Brøkar' });
  }, 60_000);
  afterAll(() => tb?.close());

  it('[LTI-013] by default Canvas gets the line item «Brøkar (formativ)» and no extension', async () => {
    // Act
    const res = await answer(tb.app, await graded());
    const record = await tb.mock.canvas.verifyDeepLinkResponse(String(res.body.jwt));
    // Assert
    expect(record.problems).toEqual([]);
    expect(record.items).toEqual([
      expect.objectContaining({ lineItem: expect.objectContaining({ label: 'Brøkar (formativ)' }) }),
    ]);
    expect(record.items[0]).not.toHaveProperty([PRESERVE_NAME_EXTENSION]);
  });

  it('[LTI-013] preserve mode keeps the teacher’s name and describes the points in the launch’s language', async () => {
    // Arrange: the Deep Linking routes as ltiRoutes mounts them, with the other mode
    const app = express();
    app.use(
      deepLinkRoutes({
        db: tb.db,
        resolveLtik: tb.lti.resolveLtik,
        canvasOrigins: [tb.mock.canvas.origin],
        publicBaseUrl: tb.toolUrl,
        labelMode: 'preserve',
      }),
    );
    // Act
    const res = await answer(app, await graded({ locale: 'nb' }));
    const record = await tb.mock.canvas.verifyDeepLinkResponse(String(res.body.jwt));
    // Assert
    expect(res.status).toBe(200);
    expect(record.problems).toEqual([]);
    const [item] = record.items;
    expect(item?.lineItem).toEqual(expect.objectContaining({ label: 'Brøkar', scoreMaximum: 100 }));
    expect(item?.[PRESERVE_NAME_EXTENSION]).toBe(true);
    expect(item?.text).toBe(t('deepLinkGrading.formativeDescription', {}, 'nb'));
  });
});
