/**
 * End-to-end test of the portal in Chromium: Feide login, sharing an activity with the session's CSRF token, and
 * logout through Feide's end-session endpoint, after which the session no longer works. The author is new in this run
 * (../test/support/runFeideAuthor.ts), so the test bed removes them and their activity when it closes.
 *
 * Spec: PROD-006, AUTH-001, AUTH-003
 */
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../src/auth/session/sessionCookies.js';
import { t } from '../src/i18n/translate.js';
import { openAppTestbed, type AppTestbed } from '../test/support/appTestbed.js';
import { describeWithServices } from '../test/support/services.js';

describeWithServices('[PROD-006] portal sharing and logout in a browser', () => {
  let tb: AppTestbed;
  let browser: Browser;
  beforeAll(async () => {
    tb = await openAppTestbed(undefined, { runAuthor: true });
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    await tb?.close();
  });

  it('[PROD-006] log in with Feide, share an activity, log out; the old session is gone', async () => {
    // Arrange: log in from the start page
    const context = await browser.newContext();
    const page = await context.newPage();
    tb.mock.feide.nextLogin('author');
    await page.goto(`${tb.toolUrl}/`);
    await page.getByRole('link', { name: t('page.login', {}, 'nn') }).click();
    const logout = page.locator('form[action="/auth/logout"] button');
    await logout.waitFor();
    const contentId = await tb.activity(await tb.feideAccount('author'), { published: true });
    // Act: share without and with the CSRF token, as a page script would
    const statuses = await page.evaluate(async (id) => {
      const { csrfToken } = (await (await fetch('/auth/session')).json()) as { csrfToken: string };
      const patch = (headers: Record<string, string>) =>
        fetch(`/api/content/${id}/sharing`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({ visibility: 'feide' }),
        }).then((r) => r.status);
      return [await patch({}), await patch({ 'x-csrf-token': csrfToken })];
    }, contentId);
    const cookie = (await context.cookies(tb.toolUrl)).find((c) => c.name === SESSION_COOKIE);
    // Act: log out
    await logout.click();
    await page.getByRole('heading', { name: t('page.loggedOut.title', {}, 'nn') }).waitFor();
    const after = await page.evaluate(async () => (await fetch('/auth/session')).status);
    // Assert
    expect(statuses).toEqual([401, 200]);
    expect((await tb.db.h5PContent.findUnique({ where: { id: contentId } }))?.visibility).toBe('feide');
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
    expect(tb.mock.feide.logouts).toHaveLength(1);
    expect(after).toBe(401);
    await context.close();
  });
});
