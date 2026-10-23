/**
 * Integration tests for launches when the web app runs: ltijs lands on the chrome page `/app/play`, which reaches the
 * web app with the launch facts and without the ltik or any credential; an invalid ltik never reaches it; and `/` is
 * the web app's start page; an H5P page opened on its own goes to its chrome page. The web app is a stub that
 * records what it received.
 *
 * Spec: LTI-006, LTI-003, DATA-006, D-067
 */
import type { IncomingMessage } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { LAUNCH_HEADER } from '../../src/web/appLaunch.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[LTI-006] launches into the web app’s chrome page', () => {
  let tb: AppTestbed;
  let published: string;
  const seen: IncomingMessage[] = [];
  beforeAll(async () => {
    tb = await openAppTestbed(undefined, {
      web: { dev: false, handle: async (req, res) => void (seen.push(req), res.end('web')) },
    });
    published = await tb.activity(await tb.staffAccount(), { published: true, title: 'Brøkar' });
  }, 60_000);
  afterAll(() => tb?.close());

  it('[LTI-006] a launch lands on /app/play, which hands the web app the facts but no ltik or credential', async () => {
    // Arrange
    const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user: CANVAS_USERS.student,
      custom: { contentId: published },
      resourceLinkId: 'chrome-link',
    });
    seen.length = 0;
    // Act
    const res = await request(tb.app)
      .get(`/app/play?ltik=${encodeURIComponent(run.ltik ?? '')}`)
      .set('Authorization', `Bearer ${run.ltik ?? ''}`);
    // Assert
    expect(run.path).toBe('/app/play');
    expect(res.text).toBe('web');
    expect(res.headers['content-security-policy']).toContain(
      `frame-ancestors 'self' ${tb.env.CANVAS_ORIGINS.join(' ')}`,
    );
    const launch = JSON.parse(decodeURIComponent(String(seen[0]?.headers[LAUNCH_HEADER])));
    expect(launch).toEqual({ contentId: published, title: 'Brøkar', mayEdit: false, locale: 'nn' });
    expect(seen[0]?.url).toBe('/app/play');
    expect(seen[0]?.headers.authorization).toBeUndefined();
    expect(JSON.stringify(seen[0]?.rawHeaders)).not.toContain(run.ltik ?? 'no-ltik');
  });

  it('[LTI-003] an invalid ltik gets the LTI reopen page (401) and never reaches the web app', async () => {
    seen.length = 0;
    const res = await request(tb.app).get('/app/play?ltik=not-a-token');
    expect(res.status).toBe(401);
    expect(seen).toEqual([]);
  });

  it('[DATA-006] an H5P page opened in a tab of its own goes to its chrome page; a frame is never redirected', async () => {
    // Act
    const top = await request(tb.app)
      .get(`/h5p/play/${published}`)
      .set({ 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' });
    const framed = await request(tb.app)
      .get(`/h5p/play/${published}`)
      .set({ 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Mode': 'navigate' });
    // Assert
    expect(top.status).toBe(303);
    expect(top.headers.location).toBe(`/aktivitet/${published}`);
    // WHY: without a session the player answers with its own login redirect; what matters is that it is not ours.
    expect(framed.status).not.toBe(303);
    expect(String(framed.headers.location ?? '')).not.toContain('/aktivitet/');
  });

  it('[LTI-006] the start page / is the web app’s, not the server-rendered one', async () => {
    seen.length = 0;
    const res = await request(tb.app).get('/');
    expect(res.text).toBe('web');
    expect(seen).toHaveLength(1);
    // WHY: the logout form's 303 to Feide's end-session endpoint must pass the page's form-action.
    expect(res.headers['content-security-policy']).toContain(
      `form-action 'self' ${new URL(tb.env.FEIDE_ISSUER).origin}`,
    );
  });
});
