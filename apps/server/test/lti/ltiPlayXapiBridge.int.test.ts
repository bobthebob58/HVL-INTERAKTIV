/**
 * Integration tests for the xAPI bridge on the Canvas player page (`/lti/play`): a student's launch gets the bridge's
 * scripts after the theme's, its configuration with the launch's ltik as the token (sent only as a header, LTI-003)
 * and the version the page was rendered with, and `reportingIsEnabled`; a teacher's launch of the same activity gets
 * none of them, so a teacher's play is never sent as learning data (D-102).
 *
 * Spec: LTI-010, H5P-009
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type CanvasUser } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { bridgeOnPage } from '../h5p/support/xapiBridgePage.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[LTI-010] the xAPI bridge on the Canvas player page', () => {
  let tb: AppTestbed;
  let published: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    published = await tb.activity(await tb.staffAccount(), { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  const playAs = async (roles: CanvasUser['roles']) => {
    const user: CanvasUser = { sub: `user-${randomUUID()}`, roles };
    const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user,
      course: { id: 'course-xapi' },
      resourceLinkId: 'link-xapi',
      custom: { contentId: published },
    });
    const res = await request(tb.app).get(`/lti/play?ltik=${encodeURIComponent(ltik ?? '')}`);
    expect(res.status).toBe(200);
    return { ltik: ltik ?? '', bridge: bridgeOnPage(res.text) };
  };

  it('[LTI-010] a student’s launch loads the bridge last, with the ltik as its token', async () => {
    // Arrange
    const { version } = await tb.db.h5PContent.findUniqueOrThrow({ where: { id: published } });
    // Act
    const { ltik, bridge } = await playAs(CANVAS_USERS.student.roles);
    // Assert
    expect(ltik).not.toBe('');
    expect(bridge.config).toEqual({
      endpoint: '/api/h5p/xapi',
      contentId: published,
      contentVersion: version,
      token: { name: 'ltik', value: ltik },
    });
    expect(bridge.scripts).toEqual(['xapiStatements.js', 'xapiBatching.js', 'xapiBridge.js']);
    expect(bridge.coreScripts).toHaveLength(3);
    expect(bridge.bridgeAfterTheme).toBe(true);
    expect(bridge.reporting).toBe(true);
  });

  it('[H5P-009] a teacher’s launch of the same activity gets no bridge and no reporting', async () => {
    // Act
    const { bridge } = await playAs(CANVAS_USERS.teacher.roles);
    // Assert
    expect(bridge).toEqual({
      config: null,
      scripts: [],
      coreScripts: [],
      reporting: undefined,
      bridgeAfterTheme: true,
    });
  });
});
