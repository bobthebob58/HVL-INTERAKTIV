/**
 * Integration tests of the rule that a launch is finished only by the browser that began it (D-141), through the
 * whole app with the mock Canvas: a launch whose last step another site sends is refused, also from a browser that
 * sends no fetch metadata, with a real ID token, state and recovery token; the same step from our own page is
 * taken; and an error page takes an ltik out of its address.
 *
 * Spec: LTI-001, LTI-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { LTIK_LANDING_SCRIPT } from '../../src/lti/play/ltiPlayRoutes.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('[LTI-001] a launch is finished only by the browser that began it', () => {
  let tb: AppTestbed;
  let published: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    published = await tb.activity(await tb.staffAccount(), { published: true, title: 'Brøkar' });
  }, 60_000);
  afterAll(() => tb.close());

  /** A launch whose last step is sent with these headers, as a real login at the mock Canvas made it. */
  const launchWith = (lastStep: Record<string, string>) =>
    launchFromCanvas(tb.app, tb.mock.canvas, { custom: { contentId: published } }, undefined, lastStep);

  it.each([
    ['no fetch metadata and no Origin', {}],
    ['no fetch metadata and another site’s Origin', { Origin: 'https://other.example' }],
    ['no fetch metadata and a null Origin', { Origin: 'null' }],
    ['fetch metadata that says another site', { 'Sec-Fetch-Site': 'cross-site' }],
  ])('[LTI-001] the last step with %s gets the «launch failed» page and no ltik', async (_name, headers) => {
    // Act: the ID token, the state and the recovery token are all genuine; only where the post came from differs
    const run = await launchWith(headers);
    // Assert
    expect(run.res.status).toBe(400);
    expect(run.ltik).toBeUndefined();
    expect(run.res.headers.location).toBeUndefined();
    expect(run.res.text).toContain('<h1>');
  });

  it('[LTI-001] the same step from our own page is taken, with fetch metadata or with our Origin alone', async () => {
    // Act
    const modern = await launchWith({ 'Sec-Fetch-Site': 'same-origin' });
    const older = await launchWith({ Origin: new URL(tb.toolUrl).origin });
    // Assert
    expect([modern.res.status, older.res.status]).toEqual([302, 302]);
    expect([modern.path, older.path]).toEqual(['/lti/play', '/lti/play']);
    expect(older.ltik).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('[LTI-001] a refused last step leaves the launch usable: the same values from our own page still launch', async () => {
    // Arrange: the refusal comes before ltijs reads the request, so the nonce is not used up
    const refused = await launchWith({ Origin: 'https://other.example' });
    // Act: the same form, sent as our page sends it
    const again = await refused.replay({ Origin: new URL(tb.toolUrl).origin });
    // Assert
    expect(refused.res.status).toBe(400);
    expect(again.status).toBe(302);
  });

  it('[LTI-003] an error page under /lti loads the script that takes an ltik out of its address', async () => {
    // Act: a page address with a token that is no ltik, as a broken or old link has it
    const res = await request(tb.app).get('/lti/play?ltik=not-a-token').set('Sec-Fetch-Site', 'same-origin');
    // Assert
    expect(res.status).toBe(401);
    expect(res.text).toContain(`<script src="${LTIK_LANDING_SCRIPT}" defer></script>`);
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect((await request(tb.app).get(LTIK_LANDING_SCRIPT)).status).toBe(200);
  });
});
