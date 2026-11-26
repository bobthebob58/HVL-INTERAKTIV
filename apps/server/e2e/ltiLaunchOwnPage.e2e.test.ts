/**
 * End-to-end test of the rule that the last step of a launch comes from our own page (D-141), in full Chromium
 * through the mock Canvas, as a browser that sends no fetch metadata makes it: the launch's two posts reach the
 * server without any `Sec-Fetch-*` header. With the `Origin` the browser sets, the launch reaches the player; with
 * the `Origin` a `no-referrer` page would give (`null`), it ends on the «launch failed» page.
 *
 * Spec: LTI-001, LTI-003
 */
import { randomUUID } from 'node:crypto';
import type { Browser, BrowserContext } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { t } from '../src/i18n/translate.js';
import { openAppTestbed, type AppTestbed } from '../test/support/appTestbed.js';
import { PROBE_LIBRARIES } from '../test/support/probeContentType.js';
import { describeWithServices } from '../test/support/services.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';

/** One post to the launch route, with the `Origin` the browser itself put on it. */
interface LaunchPost {
  readonly lastStep: boolean;
  readonly origin: string | undefined;
}

describeWithServices('[LTI-001] a launch from a browser that sends no fetch metadata', () => {
  let tb: AppTestbed;
  let browser: Browser;
  let contentId: string;
  beforeAll(async () => {
    tb = await openAppTestbed(PROBE_LIBRARIES);
    contentId = await tb.activity(await tb.staffAccount(), { published: true });
    // WHY: stock Chrome's partitioned frame storage, where ltijs's page finds its recovery token (D-050).
    browser = await launchCookieTestChromium({ partitionedStorage: true });
  });
  afterAll(async () => {
    await browser?.close();
    await tb?.close();
  });

  /**
   * Sends the launch route's posts on without fetch metadata, as an older browser's would arrive.
   * WHY: `route.fetch` makes the request from Node with exactly these headers. Chromium adds its `Sec-Fetch-*`
   * headers after this point, so they are not among them; the filter says so and guards against a change.
   */
  const withoutFetchMetadata = async (context: BrowserContext, origin?: string): Promise<LaunchPost[]> => {
    const posts: LaunchPost[] = [];
    await context.route(`${tb.toolUrl}/lti/launch`, async (route) => {
      const request = route.request();
      const sent = await request.allHeaders();
      const lastStep = (request.postData() ?? '').includes('ltijs_recovered_state=');
      posts.push({ lastStep, origin: sent.origin });
      const headers = Object.fromEntries(
        Object.entries(sent).filter(([name]) => !name.startsWith('sec-fetch-')),
      );
      if (lastStep && origin !== undefined) headers.origin = origin;
      await route.fulfill({ response: await route.fetch({ headers, maxRedirects: 0 }) });
    });
    return posts;
  };
  const spec = (): LaunchSpec => ({
    user: { sub: `student-${randomUUID()}`, roles: CANVAS_USERS.student.roles },
    course: { id: `course-${randomUUID().slice(0, 8)}` },
    resourceLinkId: `e2e-own-page-${randomUUID().slice(0, 8)}`,
    custom: { contentId },
  });

  it('[LTI-001] the launch reaches the player: the browser names our origin on the last step', async () => {
    // Arrange
    const context = await browser.newContext();
    const posts = await withoutFetchMetadata(context);
    const page = await context.newPage();
    // Act
    await page.goto(tb.mock.canvas.coursePageUrl(spec()));
    const probe = page.frameLocator('#tool_content').locator('.hvl-probe-attached .hvl-probe');
    await probe.waitFor({ timeout: 30_000 });
    // Assert: Canvas's post came from Canvas; ltijs's own page then posted with our origin, which is what let it in
    const toolOrigin = new URL(tb.toolUrl).origin;
    expect(posts.map((post) => post.lastStep)).toEqual([false, true]);
    expect(posts[0]?.origin).toBe(new URL(tb.mock.canvas.issuer).origin);
    expect(posts[1]?.origin).toBe(toolOrigin);
    expect(new URL(page.frame({ name: 'tool_content' })?.url() ?? '').pathname).toBe('/lti/play');
    await context.close();
  });

  it('[LTI-001] with a null Origin on the last step the launch ends on the «launch failed» page', async () => {
    // Arrange: the same browser and launch as above; only the last step's Origin differs. `null` is what that
    // step carried while ltijs's page was sent with `no-referrer`.
    const context = await browser.newContext();
    const posts = await withoutFetchMetadata(context, 'null');
    const page = await context.newPage();
    // Act
    await page.goto(tb.mock.canvas.coursePageUrl(spec()));
    const heading = page.frameLocator('#tool_content').locator('h1');
    await heading.waitFor({ timeout: 30_000 });
    // Assert
    expect(await heading.textContent()).toBe(t('page.error.title', {}, 'nn'));
    expect(await page.frameLocator('#tool_content').locator('main p').first().textContent()).toBe(
      t('error.launchFailed', {}, 'nn'),
    );
    expect(posts.map((post) => post.lastStep)).toEqual([false, true]);
    await context.close();
  });
});
