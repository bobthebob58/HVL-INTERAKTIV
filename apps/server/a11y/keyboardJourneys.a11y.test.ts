/**
 * Keyboard-only scripts of the journeys that exist in Session 4 (spec 00 §3): J1, a teacher picks an activity in the
 * Deep Linking picker and publishes a draft through the activity page's tabs and the publish dialog; J2, a student
 * answers a question in Canvas. Only Tab, Shift+Tab, arrows, Space, Enter, Escape and typing are used. J3 (insight,
 * S6) and J4 (portfolio, S5) do not exist yet; their manual scripts are in docs/accessibility/manual-test-protocol.md.
 *
 * Spec: UD-006, UD-004, UD-003, LTI-005, PROD-003
 */
import { expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { focusIs, tabTo } from './support/focusWalk.js';
import { openWebPage, playerFrame } from './support/pages.js';
import { openView } from './support/views.js';

const DIALOG = '[role=dialog]';
const inDialog = (page: Parameters<typeof focusIs>[0]) => focusIs(page, `${DIALOG}, ${DIALOG} *`);

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
    await tabTo(page, '[role=tab][aria-selected=true]');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const movedOnly = await tab('Sjekk og publiser').getAttribute('aria-selected');
    await page.keyboard.press('Enter');
    // Assert
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
});
