/**
 * End-to-end test of a Canvas launch in a cross-site iframe with third-party cookies blocked: launch → play →
 * answer → reopen → the answer is still there. Full Chromium, the whole server and the mock Canvas.
 *
 * Spec: LTI-003, LTI-001, H5P-005, H5P-007
 */
import { randomUUID } from 'node:crypto';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { t } from '../src/i18n/translate.js';
import { openAppTestbed, type AppTestbed } from '../test/support/appTestbed.js';
import { PROBE_LIBRARIES } from '../test/support/probeContentType.js';
import { describeWithServices } from '../test/support/services.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { launchCookieTestChromium, startCookieCanary } from '../test/support/thirdPartyCookies.js';

describeWithServices('[LTI-003] Canvas iframe with third-party cookies blocked', () => {
  let tb: AppTestbed;
  let browser: Browser;
  let contentId: string;
  beforeAll(async () => {
    tb = await openAppTestbed(PROBE_LIBRARIES);
    contentId = await tb.activity(await tb.staffAccount(), { published: true });
    browser = await launchCookieTestChromium();
  });
  afterAll(async () => {
    await browser?.close();
    await tb?.close();
  });

  /** Opens a course page with the tool and waits until the probe content type is attached in its frame. */
  const openCourse = async (page: Page, spec: LaunchSpec) => {
    await page.goto(tb.mock.canvas.coursePageUrl(spec));
    const probe = page.frameLocator('#tool_content').locator('.hvl-probe-attached .hvl-probe');
    await probe.waitFor({ timeout: 30_000 });
    return probe;
  };
  /** Requests to the tool that failed, as `status url` (ltik and CSRF values cut off). */
  const failures = (page: Page): string[] => {
    const seen: string[] = [];
    page.on('response', (r) => {
      if (r.url().startsWith(tb.toolUrl) && r.status() >= 400)
        seen.push(`${r.status()} ${r.url().split('?')[0]}`);
    });
    return seen;
  };

  it('[LTI-003] the browser really blocks third-party cookies (canary)', async () => {
    const canary = await startCookieCanary();
    const page = await browser.newPage();
    const report = await canary.open(page);
    await page.close();
    await canary.close();
    expect(report.documentCookie).toBe('');
    expect(report.followUpCookie).toBe('');
  });

  describe.each([
    ['stock Chrome: partitioned frame storage, no Platform Storage', true, false],
    ['frame storage blocked: LTI Platform Storage (postMessage)', false, true],
  ])('%s', (_name, partitionedStorage, platformStorage) => {
    let variant: Browser;
    beforeAll(async () => {
      variant = await launchCookieTestChromium({ partitionedStorage });
    });
    afterAll(() => variant?.close());

    it('[LTI-003] launch → play → answer → reopen resumes the answer, with no tool cookie and no ltik in the URL', async () => {
      // Arrange
      const context = await variant.newContext();
      const page = await context.newPage();
      const failed = failures(page);
      // WHY: the record sees the Set-Cookie headers the blocked browser drops; the jar alone cannot show them.
      const flow = await recordFlow(page, tb.toolUrl);
      const spec: LaunchSpec = {
        user: { sub: `student-${randomUUID()}`, roles: CANVAS_USERS.student.roles },
        course: { id: `course-${randomUUID().slice(0, 8)}` },
        resourceLinkId: `e2e-link-${String(platformStorage)}`,
        custom: { contentId },
        platformStorage,
      };
      // Act: play and answer twice, and wait for H5P's periodic save
      const probe = await openCourse(page, spec);
      const frameUrl = page.frame({ name: 'tool_content' })?.url() ?? '';
      await probe.click();
      await probe.click();
      const saved = await page.waitForResponse(
        (r) =>
          r.url().includes(`/h5p/contentUserData/${contentId}/state/0`) && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      // Act: reopen the course page, which launches again
      const resumed = await openCourse(page, spec);
      // Assert
      expect(new URL(frameUrl).pathname).toBe('/lti/play');
      expect(frameUrl).not.toContain('ltik=');
      expect(saved.status()).toBe(200);
      expect(await resumed.textContent()).toBe('2');
      expect(await context.cookies(tb.toolUrl)).toEqual([]);
      await flow.settled();
      expect(flow.setCookies).toEqual([]);
      expect(failed).toEqual([]);
      await context.close();
    });
  });

  it('[LTI-003] with frame storage blocked and no Platform Storage, the launch ends on our page, not an error dump', async () => {
    // Arrange
    const page = await browser.newPage();
    // Act
    await page.goto(
      tb.mock.canvas.coursePageUrl({ resourceLinkId: 'e2e-no-storage', custom: { contentId } }),
    );
    const heading = page.frameLocator('#tool_content').locator('h1');
    await heading.waitFor({ timeout: 30_000 });
    // Assert
    expect(await heading.textContent()).toBe(t('page.error.title', {}, 'nn'));
    await page.close();
  });
});
