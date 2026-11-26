/**
 * End-to-end test of the Hjelp link on a page Express renders itself, where a teacher meets it (UD-013): the Deep
 * Linking picker as the page of Canvas's iframe, after a real launch in Chromium, starts with the header whose Hjelp
 * link opens a new tab, although the launch's last step is a post from our own origin into that frame; the player
 * frame inside our own chrome on `/app/play` has no second header, because the chrome's header with Hjelp is right
 * above it. The whole server with the built web app (../test/support/realWebApp.ts).
 *
 * Spec: UD-013, UD-007
 */
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../tools/mock-platform/mockPlatform.mjs';
import { t } from '../src/i18n/translate.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';

describeWithRealWebApp('[UD-013] the Hjelp link on the pages of Canvas’s frame', () => {
  let browser: Browser;
  let app: RealWebApp;
  let page: Page;
  let contentId: string;
  beforeAll(async () => {
    // WHY: third-party cookies blocked, as in a real Canvas frame; the launch then goes by platform storage (D-065).
    browser = await launchCookieTestChromium();
    app = await openRealWebApp(browser);
    // WHY: the picker lists the teacher's activities; `teacherActivity` makes the teacher and one to play.
    contentId = await app.teacherActivity();
    page = await (await browser.newContext()).newPage();
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[UD-013] the picker in Canvas’s frame shows one Hjelp link, which opens a new tab', async () => {
    // Arrange
    const spec = {
      messageType: 'LtiDeepLinkingRequest',
      user: CANVAS_USERS.teacher,
      placement: 'assignment_selection',
      platformStorage: true,
    } as const;
    // Act: the real launch, in the frame of the mock Canvas's course page
    await page.goto(app.tb.mock.canvas.coursePageUrl(spec));
    const picker = page.frameLocator('#tool_content');
    await picker.locator('#deep-link-form').waitFor({ timeout: 30_000 });
    const help = picker.getByRole('banner').getByRole('link', { name: t('page.help.link', {}, 'nn') });
    // Assert
    expect(await help.count()).toBe(1);
    expect(await help.getAttribute('href')).toBe('/hjelp?lang=nn');
    expect(await help.getAttribute('target')).toBe('_blank');
    expect(await picker.locator('a.hvl-skip-link').count()).toBe(1);
  });

  it('[UD-013] the player frame inside our own chrome repeats no header: Hjelp is in the chrome above it', async () => {
    // Arrange
    const spec = {
      user: CANVAS_USERS.teacher,
      custom: { contentId },
      resourceLinkId: 'e2e-help-link',
      platformStorage: true,
    };
    // Act: the launch lands on `/app/play`, whose chrome frames the player
    await page.goto(app.tb.mock.canvas.coursePageUrl(spec));
    const chrome = page.frameLocator('#tool_content');
    const player = chrome.frameLocator('iframe').first();
    await player.locator('.h5p-content, .h5p-iframe').first().waitFor({ state: 'attached', timeout: 60_000 });
    // Assert
    expect(await chrome.getByRole('banner').getByRole('link', { name: /Hjelp/ }).count()).toBe(1);
    expect(await player.getByRole('banner').count()).toBe(0);
    expect(await player.locator('a.hvl-skip-link').count()).toBe(0);
  });
});
