/**
 * Integration tests that the pages a launch lands on take the ltik in their address only from our own pages
 * (D-130): after a real launch from the mock Canvas, `/lti/play`, `/lti/edit` and `/lti/deeplink` open when the
 * browser says the navigation is same-origin, or says nothing just after the launch, and answer with the «open it
 * again from Canvas» page when it says anything else.
 *
 * Spec: LTI-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[LTI-003] where a landing address came from', () => {
  let tb: AppTestbed;
  /** The three landing pages Express renders itself, each with an ltik that opens it. */
  let pages: [path: string, ltik: string][];
  const launch = async (spec: Parameters<typeof launchFromCanvas>[2]) =>
    (await launchFromCanvas(tb.app, tb.mock.canvas, { user: CANVAS_USERS.teacher, ...spec })).ltik ?? '';
  beforeAll(async () => {
    tb = await openAppTestbed();
    const first = await tb.activity(await tb.staffAccount(), { published: true });
    const { principal } = await tb.lti.resolveLtik(await launch({ custom: { contentId: first } }));
    const owned = await tb.activity(principal.userId, { published: true });
    const opened = await launch({ custom: { contentId: owned }, resourceLinkId: 'landing-link' });
    pages = [
      ['/lti/play', opened],
      ['/lti/edit', opened],
      ['/lti/deeplink', await launch({ messageType: 'LtiDeepLinkingRequest' })],
    ];
  }, 60_000);
  afterAll(() => tb.close());

  /** Opens each page with its ltik in the address and the given `Sec-Fetch-Site`; none when undefined. */
  const open = (site?: string) =>
    Promise.all(
      pages.map(([path, ltik]) => {
        const asked = request(tb.app).get(`${path}?ltik=${encodeURIComponent(ltik)}`);
        return site === undefined ? asked : asked.set('Sec-Fetch-Site', site);
      }),
    );

  it('[LTI-003] from our own page, and from a browser that says nothing just after the launch, the pages open', async () => {
    // Act
    const sameOrigin = await open('same-origin');
    const silent = await open();
    // Assert
    expect(sameOrigin.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(silent.map((res) => res.status)).toEqual([200, 200, 200]);
  });

  it.each(['cross-site', 'same-site', 'none'])(
    '[LTI-003] with Sec-Fetch-Site «%s» every landing page answers «open it again from Canvas», and shows nothing',
    async (site) => {
      // Act
      const answers = await open(site);
      // Assert
      expect(answers.map((res) => res.status)).toEqual([401, 401, 401]);
      for (const res of answers) {
        expect(res.text).toContain('<h1>');
        expect(res.text).not.toContain('h5p-integration');
        expect(res.headers['cache-control']).toBe('no-store');
      }
    },
  );

  it('[LTI-003] the same ltik still works as a Bearer token for the page’s own requests', async () => {
    // Act
    const res = await request(tb.app)
      .get('/api/me')
      .set('Authorization', `Bearer ${pages[0]?.[1] ?? ''}`)
      .set('Sec-Fetch-Site', 'cross-site');
    // Assert
    expect(res.status).toBe(200);
  });
});
