/**
 * Keyboard-only scripts of the journeys of spec 00 §3: J1, a teacher picks an activity in the Deep Linking picker
 * and publishes a draft through the activity page's tabs and the publish dialog (focus stays on the button, now
 * **Gjer om til utkast**), and the author dismisses the formative-use notice on the Rediger tab (focus stays in the
 * tab panel, the dismissal is kept); J2, a student answers a question in Canvas; J3, the teacher opens **Innsikt**,
 * asks for another period and takes question 2 to the seminar on the big screen (S6; the view answered by routing,
 * ./support/insightViews.ts). Only Tab, Shift+Tab, arrows, Space, Enter, Escape and typing are used. The studio's
 * journeys (S5), with J4's start on `/mappe`, are in keyboardStudioJourneys.a11y.test.ts. The manual scripts are in
 * docs/accessibility/manual-test-protocol.md.
 *
 * Spec: UD-006, UD-004, UD-003, LTI-005, PROD-003, PROD-011, INS-001, INS-003
 */
import type { Me } from '@hvl-interaktiv/api-contract';
import type { Response } from 'playwright-core';
import { expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { focusIs, tabTo } from './support/focusWalk.js';
import { FORMATIVE_NOTICE, noticeRegion } from './support/formativeNotice.js';
import { SECOND_QUESTION } from './support/insightFixture.js';
import { routeInsight } from './support/insightViews.js';
import { openWebPage, playerFrame } from './support/pages.js';
import { openView } from './support/views.js';
import { webText } from '../test/support/webAppTexts.js';

const DIALOG = '[role=dialog]';
/** Whether a response answers the notice's read of the dismissals (`GET /api/me`). */
const isMeRead = (response: Response): boolean =>
  new URL(response.url()).pathname === '/api/me' && response.request().method() === 'GET';
const inDialog = (page: Parameters<typeof focusIs>[0]) => focusIs(page, `${DIALOG}, ${DIALOG} *`);
const focusedText = (page: Parameters<typeof focusIs>[0]) =>
  page.evaluate(() => document.activeElement?.textContent ?? '');
const PANEL = '[role=tabpanel]:not([hidden])';

describeA11y('[UD-006] keyboard-only journeys', (env) => {
  it('[UD-006] J1: the teacher picks an activity in the Deep Linking picker and returns to Canvas', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext();
    const ltik = await app.deepLink();
    const page = await openWebPage(
      context,
      app.base,
      `/lti/deeplink?ltik=${encodeURIComponent(ltik)}`,
      false,
    );
    // Act
    await tabTo(page, 'input[name=contentId]:not([disabled])');
    await page.keyboard.press('Space');
    await tabTo(page, 'button[type=submit]');
    const leaving = page.waitForURL((url) => url.origin !== new URL(app.base).origin, { timeout: 15_000 });
    await page.keyboard.press('Enter');
    // Assert
    await leaving;
    expect(new URL(page.url()).origin).not.toBe(new URL(app.base).origin);
    await context.close();
  });

  it('[UD-006] J1: tabs move with the arrows and select with Enter (manual activation)', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await openView(app, context, { kind: 'activity', tab: 'play' });
    const tab = (name: string) => page.getByRole('tab', { name });
    // Act
    // WHY: the number of tabs between Spel and «Sjekk og publiser» grows as S5 adds tabs, so it is read, not fixed.
    const steps = (await page.getByRole('tab').allTextContents()).indexOf('Sjekk og publiser');
    await tabTo(page, '[role=tab][aria-selected=true]');
    for (let step = 0; step < steps; step += 1) await page.keyboard.press('ArrowRight');
    const focusedName = await page.evaluate(() => document.activeElement?.textContent);
    const movedOnly = await tab('Sjekk og publiser').getAttribute('aria-selected');
    await page.keyboard.press('Enter');
    // Assert
    expect(steps).toBeGreaterThan(1);
    expect(focusedName).toBe('Sjekk og publiser');
    expect(await focusIs(page, '[role=tab]')).toBe(true);
    expect(movedOnly).toBe('false');
    await expect.poll(() => tab('Sjekk og publiser').getAttribute('aria-selected')).toBe('true');
    await context.close();
  });

  it('[UD-006] J1: the publish dialog keeps focus inside, returns it on Escape, and publishes by keyboard', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await openView(app, context, { kind: 'activity', tab: 'check' });
    // Act and assert: open, wrap, close
    await tabTo(page, '[role=tabpanel] button.button-primary');
    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'Publiser aktiviteten' }).waitFor();
    expect(await inDialog(page)).toBe(true);
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await inDialog(page)).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect.poll(() => page.getByRole('dialog').count()).toBe(0);
    expect(await focusIs(page, 'button')).toBe(true);
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Publiser');
    // Act and assert: publish, giving a reason for any error by typing it
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    for (let i = 0; i < 30 && !(await focusIs(page, `${DIALOG} button[type=submit]`)); i += 1) {
      await page.keyboard.press('Tab');
      if (await focusIs(page, `${DIALOG} textarea`))
        await page.keyboard.type('Formativ øving; feilen er kjend.');
    }
    await page.keyboard.press('Enter');
    await expect.poll(() => page.getByRole('dialog').count(), { timeout: 15_000 }).toBe(0);
    await expect.poll(() => page.getByText('Aktiviteten er publisert.').count()).toBeGreaterThan(0);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim()))
      .toBe('Gjer om til utkast');
    await context.close();
  });

  it('[UD-006] J2: a student answers a MultiChoice question in Canvas and hears the verdict', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext();
    const page = await openView(app, context, { kind: 'canvas' });
    const player = await playerFrame(page);
    // Act
    await tabTo(page, '.h5p-answer');
    await page.keyboard.press('Space');
    await tabTo(page, '.h5p-question-check-answer');
    await page.keyboard.press('Enter');
    // Assert
    await expect.poll(() => player.locator('.h5p-content').ariaSnapshot()).toMatch(/Riktig: |Feil: /);
    await context.close();
  });

  it('[UD-006][INS-003] J3: the teacher opens Innsikt, asks for 14 days and shows question 2 on the big screen', async () => {
    // Arrange: the QuestionSet's activity page, its insight view answered by routing
    const { app, browser } = env();
    const context = await browser.newContext({ storageState: app.authorStorage });
    const contentId = app.ids.get('H5P.QuestionSet') ?? '';
    await routeInsight(context, contentId, { key: 'portal', label: null });
    const page = await openView(app, context, { kind: 'activity', tab: 'play' }, { contentId });
    const asked = page.waitForRequest((r) => new URL(r.url()).searchParams.get('period') === '14d');
    const steps = (await page.getByRole('tab').allTextContents()).indexOf(webText('insight.tab'));
    // Act: to Innsikt with the arrows and Enter; the next period with an arrow key, then «Vis innsikt»
    await tabTo(page, '[role=tab][aria-selected=true]');
    for (let step = 0; step < steps; step += 1) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await tabTo(page, `${PANEL} form select`);
    await page.keyboard.press('ArrowDown');
    await tabTo(page, `${PANEL} form button[type=submit]`);
    await page.keyboard.press('Enter');
    await asked;
    await page.locator(`${PANEL} table`).first().waitFor();
    // Act: Tab to question 2's «Ta opp i samlinga» and press Space; open the list for projecting, then Escape
    for (let i = 0; i < 8 && !(await focusedText(page)).includes(SECOND_QUESTION); i += 1)
      await tabTo(page, `${PANEL} button[aria-pressed]`);
    await page.keyboard.press('Space');
    const pressed = await page.evaluate(() => document.activeElement?.getAttribute('aria-pressed'));
    await tabTo(page, '.insight-shortlist > div > button.button-secondary');
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').getByText(SECOND_QUESTION).waitFor();
    await page.keyboard.press('Escape');
    // Assert: question 2 was on the big screen (waited for above), and focus is back on the button
    expect(steps).toBeGreaterThan(0);
    expect(pressed).toBe('true');
    await expect.poll(() => page.getByRole('dialog').count()).toBe(0);
    expect(await focusedText(page)).toBe(webText('insight.shortlist.project'));
    await context.close();
  });

  it('[UD-006][PROD-011] J1: the author dismisses the formative-use notice on Rediger by keyboard; focus stays in the panel', async () => {
    // Arrange: the run's author has never dismissed it, so it shows
    const { app, browser } = env();
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await openView(app, context, { kind: 'activity', tab: 'edit' });
    await noticeRegion(page).waitFor({ timeout: 15_000 });
    // Act
    await tabTo(page, '[role=tabpanel] section[aria-labelledby] button');
    const dismissText = await page.evaluate(() => document.activeElement?.textContent?.trim());
    await page.keyboard.press('Enter');
    await expect.poll(() => noticeRegion(page).count()).toBe(0);
    const focusAfter = await page.evaluate(() => document.activeElement?.getAttribute('role'));
    const stored = await app.tb.db.noticeDismissal.count({ where: { userId: app.authorId } });
    await page.close();
    // WHY: the notice renders nothing until GET /api/me answers, so "not shown" means something only after that.
    const meAnswered = context.waitForEvent('response', isMeRead);
    const again = await openView(app, context, { kind: 'activity', tab: 'edit' });
    const me = (await (await meAnswered).json()) as Me;
    await again.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const shownAgain = await noticeRegion(again).count();
    await app.tb.db.noticeDismissal.deleteMany({ where: { userId: app.authorId } });
    // Assert
    expect(dismissText).toBe(FORMATIVE_NOTICE.dismiss);
    expect(focusAfter).toBe('tabpanel');
    expect(stored).toBe(1);
    expect(me.dismissedNotices.map((notice) => notice.noticeId)).toEqual(['formative-use']);
    expect(shownAgain).toBe(0);
    await context.close();
  });
});
