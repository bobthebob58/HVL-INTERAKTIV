/**
 * The Innsikt tab (S6) under axe, the keyboard and print: the portal's tab of an activity with a question on the
 * «Ta opp i samlinga» list, with its «< 5» cells and the note that the numbers run up to yesterday; the same tab
 * for a period shortened to start on 1 August, with its second note; and the tab on a teacher's Canvas page; each in
 * the light theme and with forced colours emulated. Then a keyboard-only pass (Tab to «Ta opp i samlinga», Space
 * adds the question and it is announced, the projection dialog opens with Enter and Escape returns focus); then the
 * print stylesheet, which prints the list alone, scanned by axe as printed. No serious or critical violation. The
 * insight view is answered by routing (./support/insightViews.ts, ./support/insightFixture.ts).
 *
 * Spec: UD-030, UD-006, INS-008, INS-003, INS-006, PROD-010
 */
import type { Page } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { webText } from '../test/support/webAppTexts.js';
import { describeA11y } from './support/a11ySuite.js';
import { scanPage } from './support/axeScan.js';
import { COLOUR_MODES } from './support/catalogue.js';
import { focusIs, tabTo } from './support/focusWalk.js';
import { FIRST_QUESTION as QUESTION, SHORTENED_PERIOD } from './support/insightFixture.js';
import { openCanvasInsight, openPortalInsight } from './support/insightViews.js';
import { expectOnlyRecorded } from './support/upstreamFindings.js';

const ADD = `${webText('insight.shortlist.add')} (${QUESTION})`;
const PANEL = '[role=tabpanel]:not([hidden])';
const PROJECT = '.insight-shortlist > div > button.button-secondary';
/** The hidden reason of each «< 5» value shown (apps/web `insight.suppressedSr`). */
const suppressedCount = (page: Page) =>
  page.locator(`${PANEL} .sr-only`, { hasText: webText('insight.suppressedSr') }).count();
/** The start of each period note (apps/web `insight.period.*`), up to its first placeholder. */
const NOTE_START = {
  throughYesterday: webText('insight.period.throughYesterday', { last: '§' }).split('§')[0] ?? '',
  shortened: webText('insight.period.shortened', { start: '§' }).split('§')[0] ?? '',
};
const noteCount = (page: Page, note: keyof typeof NOTE_START) =>
  page.locator(`${PANEL} p`, { hasText: NOTE_START[note] }).count();

describeA11y('[UD-030] axe on the Innsikt tab', (env) => {
  describe.each(COLOUR_MODES)('%s', (mode, forcedColors) => {
    it('[UD-030][INS-008] the portal’s Innsikt tab, with a question on the list, has no serious or critical violation', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
      const page = await openPortalInsight(app, context, app.ids.get('H5P.QuestionSet') ?? '');
      await page.getByRole('button', { name: ADD }).first().click();
      // Act
      const report = await scanPage(page, `${mode}: /aktivitet/[id] Innsikt`);
      // Assert: every chart has its summary and table, the notes are there, and the list holds the question
      const figures = page.locator(`${PANEL} figure`);
      expect(await figures.count()).toBe(3);
      expect(await page.locator(`${PANEL} figure table caption`).count()).toBe(3);
      expect(await page.getByRole('region', { name: webText('notice.formativeUse.title') }).count()).toBe(1);
      expect(await page.getByRole('region', { name: webText('insight.privacy.heading') }).count()).toBe(1);
      expect(await page.locator('.insight-shortlist li').count()).toBe(1);
      // Assert: the hidden values say why, and the period note says the numbers run up to yesterday (INS-006, D-106)
      expect(await suppressedCount(page)).toBeGreaterThanOrEqual(5);
      expect([await noteCount(page, 'throughYesterday'), await noteCount(page, 'shortened')]).toEqual([1, 0]);
      expectOnlyRecorded(report, []);
      await context.close();
    });

    it('[UD-030][PROD-010] the portal’s Innsikt tab for a period shortened to 1 August has no serious or critical violation', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
      const contentId = app.ids.get('H5P.QuestionSet') ?? '';
      const page = await openPortalInsight(app, context, contentId, SHORTENED_PERIOD);
      // Act
      const report = await scanPage(page, `${mode}: /aktivitet/[id] Innsikt, shortened period`);
      // Assert: both period notes, after the scope line they qualify
      expect([await noteCount(page, 'throughYesterday'), await noteCount(page, 'shortened')]).toEqual([1, 1]);
      expectOnlyRecorded(report, []);
      await context.close();
    });

    it('[UD-030][INS-008] the Canvas page’s Innsikt tab has no serious or critical violation', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors });
      const page = await openCanvasInsight(app, context);
      // Act
      const report = await scanPage(page, `${mode}: /app/play Innsikt`);
      // Assert: the course is named, not chosen (D-106)
      expect(await page.getByRole('combobox', { name: webText('insight.query.context') }).count()).toBe(0);
      expect(await page.getByText(/^Emne: SYK110 i Canvas\./).count()).toBe(1);
      expectOnlyRecorded(report, []);
      await context.close();
    });
  });

  it('[UD-006][INS-003] keyboard: Tab reaches «Ta opp i samlinga», Space adds it and it is said, the list opens for projecting and Escape returns focus', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await openPortalInsight(app, context, app.ids.get('H5P.QuestionSet') ?? '');
    // Act: from the selected tab, Tab to the first toggle and press Space
    await page.getByRole('tab', { name: webText('insight.tab') }).focus();
    await tabTo(page, `${PANEL} button[aria-pressed]`);
    await page.keyboard.press('Space');
    // Assert: pressed, on the list, and said in the tab's status region
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-pressed'))).toBe('true');
    const said = webText('insight.shortlist.added', { question: QUESTION, count: 1 });
    await expect.poll(() => page.locator(`${PANEL} p.sr-only[role=status]`).textContent()).toBe(said);
    // Act: Tab to «Vis lista på storskjerm», Enter opens the dialog, Escape closes it
    await tabTo(page, PROJECT);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    // Assert: named by its heading, with the question; Escape closes it and focus is back on the button
    expect(await dialog.getByRole('heading', { level: 2 }).textContent()).toMatch(/^Til samlinga: /);
    expect(await dialog.getByText(QUESTION).count()).toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => dialog.count()).toBe(0);
    await expect.poll(() => focusIs(page, PROJECT)).toBe(true);
    await context.close();
  });

  it('[INS-003][UD-030] print: while the list is printed, only the list and its heading show, without buttons or violations', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await openPortalInsight(app, context, app.ids.get('H5P.QuestionSet') ?? '');
    await page.getByRole('button', { name: ADD }).first().click();
    // Act: the mark printShortlist sets, in print media
    await page.evaluate(() => document.documentElement.setAttribute('data-insight-print', ''));
    await page.emulateMedia({ media: 'print' });
    const shown = await page.evaluate(() => {
      const visible = (element: Element | null) => !!element && getComputedStyle(element).display !== 'none';
      const list = document.querySelector('.insight-shortlist');
      return {
        list: visible(list),
        item: visible(list?.querySelector('li') ?? null),
        printHeading: visible(list?.querySelector('p.print\\:block') ?? null),
        buttons: [...(list?.querySelectorAll('button') ?? [])].filter(visible).length,
        tabs: visible(document.querySelector('[role=tablist]')),
        header: visible(document.querySelector('header')),
        participation: visible(document.querySelector('dl')),
      };
    });
    const report = await scanPage(page, 'print: the «Ta opp i samlinga» list');
    // Assert
    expect(shown).toEqual({
      list: true,
      item: true,
      printHeading: true,
      buttons: 0,
      tabs: false,
      header: false,
      participation: false,
    });
    expectOnlyRecorded(report, []);
    await context.close();
  });
});
