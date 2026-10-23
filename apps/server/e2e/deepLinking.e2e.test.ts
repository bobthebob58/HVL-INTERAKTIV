/**
 * End-to-end test of the Deep Linking round trip in Chromium: a teacher opens the picker in the Canvas iframe,
 * chooses an activity, and the mock Canvas receives and accepts the signed answer.
 *
 * Spec: LTI-005, PROD-005, LTI-003
 */
import { randomUUID } from 'node:crypto';
import type { Browser } from 'playwright-core';
import { t } from '../src/i18n/translate.js';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type CanvasUser } from '../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../test/support/appTestbed.js';
import { launchFromCanvas } from '../test/support/ltiLaunchDriver.js';
import { describeWithServices } from '../test/support/services.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';

describeWithServices('[LTI-005] Deep Linking round trip in a browser', () => {
  let tb: AppTestbed;
  let browser: Browser;
  let teacher: CanvasUser;
  let chosen: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    teacher = { sub: `teacher-${randomUUID()}`, roles: CANVAS_USERS.teacher.roles };
    const first = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: teacher,
    });
    const { principal } = await tb.lti.resolveLtik(first.ltik ?? '');
    chosen = await tb.activity(principal.userId, { published: true, title: 'Brøkar' });
    await tb.activity(principal.userId, { title: 'Utkast' });
    browser = await launchCookieTestChromium({ partitionedStorage: true });
  });
  afterAll(async () => {
    await browser?.close();
    await tb?.close();
  });

  it('[PROD-011] the formative notice closes, gives focus to the heading and stays closed for this teacher', async () => {
    // Arrange
    const startedAt = new Date();
    const page = await browser.newPage();
    await page.goto(tb.mock.canvas.coursePageUrl({ messageType: 'LtiDeepLinkingRequest', user: teacher }));
    const picker = page.frameLocator('#tool_content');
    const notice = picker.locator('#formative-notice');
    await notice.waitFor({ timeout: 30_000 });
    // Act
    await picker.getByRole('button', { name: t('notice.formativeUse.dismiss', {}, 'nn') }).click();
    // Assert
    await expect.poll(() => notice.isHidden()).toBe(true);
    expect(await picker.locator('h1').evaluate((h1) => h1 === document.activeElement)).toBe(true);
    const fromThisTest = { noticeId: 'formative-use', noticeVersion: 1, at: { gte: startedAt } };
    await expect.poll(() => tb.db.noticeDismissal.count({ where: fromThisTest })).toBe(1);
    await tb.db.noticeDismissal.deleteMany({ where: fromThisTest });
    await page.close();
  });

  it('[LTI-005] the teacher picks an activity and Canvas accepts the signed answer with a line item', async () => {
    // Arrange
    const page = await browser.newPage();
    await page.goto(
      tb.mock.canvas.coursePageUrl({
        messageType: 'LtiDeepLinkingRequest',
        user: teacher,
        placement: 'assignment_selection',
      }),
    );
    const picker = page.frameLocator('#tool_content');
    await picker.locator('#deep-link-form').waitFor({ timeout: 30_000 });
    const pickerUrl = page.frame({ name: 'tool_content' })?.url() ?? '';
    const draftDisabled = await picker.getByLabel('Utkast').isDisabled();
    // Act
    await picker.getByLabel('Brøkar').check();
    await picker.getByRole('button', { name: t('deepLink.submit', {}, 'nn') }).click();
    await expect.poll(() => tb.mock.canvas.deepLinkResponses.length, { timeout: 15_000 }).toBe(1);
    // Assert
    const [record] = tb.mock.canvas.deepLinkResponses;
    expect(pickerUrl).not.toContain('ltik=');
    expect(draftDisabled).toBe(true);
    expect(record?.problems).toEqual([]);
    expect(record?.items).toEqual([
      expect.objectContaining({
        custom: { contentId: chosen },
        lineItem: expect.objectContaining({ scoreMaximum: 100 }),
      }),
    ]);
    await page.close();
  });
});
