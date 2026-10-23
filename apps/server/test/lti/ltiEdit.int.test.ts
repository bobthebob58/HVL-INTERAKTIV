/**
 * Integration tests for `/lti/edit`: the owner of a launched activity gets the editor with the LTI page headers and
 * the ltik as their token; anyone else, and an invalid ltik, get the friendly LTI pages.
 *
 * Spec: LTI-006, LTI-003, H5P-006
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[LTI-006] the editor inside Canvas', () => {
  let tb: AppTestbed;
  let owned: string;
  let foreign: string;
  const launch = async (contentId: string, user = CANVAS_USERS.teacher) =>
    (
      await launchFromCanvas(tb.app, tb.mock.canvas, {
        user,
        custom: { contentId },
        resourceLinkId: `edit-${contentId}`,
      })
    ).ltik ?? '';
  beforeAll(async () => {
    tb = await openAppTestbed();
    foreign = await tb.activity(await tb.staffAccount(), { published: true });
    const { principal } = await tb.lti.resolveLtik(await launch(foreign));
    owned = await tb.activity(principal.userId, { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  it('[LTI-006] the owner gets the editor with the LTI headers and the ltik as the page’s token', async () => {
    // Arrange
    const ltik = await launch(owned);
    // Act
    const res = await request(tb.app).get(`/lti/edit?ltik=${encodeURIComponent(ltik)}`);
    // Assert
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-frame-options']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain(
      `frame-ancestors 'self' ${tb.env.CANVAS_ORIGINS.join(' ')}`,
    );
    expect(res.text).toMatch(
      /<script src="\/static\/lti\/ltikLanding\.js"><\/script>\n<script src="\/static\/lti\/h5pStorageGuard\.js">/,
    );
    expect(res.text).toContain(`"token":{"name":"ltik","value":"${ltik}"}`);
  });

  it('[H5P-006] a teacher who neither owns nor co-authors the activity gets the “not available” page', async () => {
    const res = await request(tb.app).get(`/lti/edit?ltik=${encodeURIComponent(await launch(foreign))}`);
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('h5p-integration');
  });

  it('[H5P-006] a student gets the same page', async () => {
    const ltik = await launch(owned, CANVAS_USERS.student);
    const res = await request(tb.app).get(`/lti/edit?ltik=${encodeURIComponent(ltik)}`);
    expect(res.status).toBe(404);
  });

  it('[LTI-003] an invalid or missing ltik gets the “open it again from Canvas” page with 401', async () => {
    for (const path of ['/lti/edit?ltik=not-a-token', '/lti/edit']) {
      expect((await request(tb.app).get(path)).status).toBe(401);
    }
  });
});
