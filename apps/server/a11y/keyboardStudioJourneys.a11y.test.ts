/**
 * Keyboard-only scripts of the studio's journeys (S5): the pattern catalogue filtered with a select (focus stays on
 * the control, the address keeps the filter, the count is announced in a status region); the planner's table region
 * reached with Tab and scrolled sideways with the arrow keys at a phone's width, and its «Lag frå mønster» link,
 * which opens the catalogue with its heading focused and in view; the **Deling** tab's people search, where adding a
 * colleague returns focus to the search field and announces the change, and a co-author's «Fjern meg», after which
 * focus is on the lasting message; and J4's start on `/mappe`: «Vel alle som passar» and «Fjern alle» in the
 * picker, then the Markdown download. Only Tab, Shift+Tab, arrows, Enter and typing are used.
 *
 * Spec: UD-006, PED-003, PED-031, PROD-007, MAPPE-001
 */
import { MAPPE_MAX_ACTIVITIES, type StudioOverview } from '@hvl-interaktiv/api-contract';
import type { Page } from 'playwright-core';
import { expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { inspectFocus } from './support/focusInspect.js';
import { focusIs, tabTo } from './support/focusWalk.js';
import { openWebPage } from './support/pages.js';
import { coAuthoredActivity } from './support/staffActivities.js';
import { openStudioView } from './support/studioViews.js';
import { webText } from '../test/support/webAppTexts.js';

/** The text of the element that has focus, or `<body>` when focus is on none (not the whole page's text). */
const focusedText = (page: Page): Promise<string | undefined> =>
  page.evaluate(() =>
    document.activeElement === document.body ? '<body>' : document.activeElement?.textContent?.trim(),
  );

/** Presses Tab (or Shift+Tab) until the focused element's text is `text`. */
async function tabToText(page: Page, text: string, key = 'Tab'): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    await page.keyboard.press(key);
    if ((await focusedText(page)) === text) return;
  }
  throw new Error(`«${text}» was not reached with 60 presses of ${key}`);
}

describeA11y('[UD-006] keyboard-only journeys in the studio', (env) => {
  it('[UD-006][PED-003] the catalogue filters by keyboard: focus stays on the select and the count is announced', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext();
    const { patterns } = (await (await fetch(`${app.base}/api/studio`)).json()) as StudioOverview;
    const page = await openWebPage(context, app.base, '/laeringsdesign');
    const catalogue = page.locator('#monsterkatalog');
    const cards = catalogue.locator(':scope > ul > li');
    // Act: the first filter (phase), one step down with the arrow key
    await tabTo(page, '#monsterkatalog select');
    const control = await page.evaluate(() => document.activeElement?.id);
    await page.keyboard.press('ArrowDown');
    await page.waitForURL(/[?&]fase=/);
    // Assert: the catalogue shows the server's patterns of the chosen phase, and says how many
    const phase = new URL(page.url()).searchParams.get('fase') ?? '';
    const shown = patterns.filter((p) => (p.phases as readonly string[]).includes(phase)).length;
    await expect.poll(() => cards.count()).toBe(shown);
    await expect
      .poll(() => catalogue.getByRole('status').textContent())
      .toBe(webText('studio.catalogueCount', { shown, total: patterns.length }));
    expect(control).toMatch(/\S/);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(control);
    await context.close();
  });

  it('[UD-006][PED-031] the planner’s table region is reached with Tab and scrolls sideways with the arrow keys', async () => {
    // Arrange: a phone's width, where the table is wider than the page
    const { app, browser } = env();
    const viewport = { width: 390, height: 844 };
    const context = await browser.newContext({ viewport, storageState: app.authorStorage });
    const page = await openStudioView(app, context, 'planner');
    const region = page.locator('main [role=region]:has(table)');
    // Act
    await tabTo(page, 'main [role=region]:has(table)');
    const name = await region.evaluate((r) =>
      document.getElementById(r.getAttribute('aria-labelledby') ?? '')?.textContent?.trim(),
    );
    for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowRight');
    // Assert
    expect(await region.evaluate((r) => r.scrollWidth > r.clientWidth)).toBe(true);
    await expect.poll(() => region.evaluate((r) => r.scrollLeft)).toBeGreaterThan(0);
    expect(name).toBe(webText('planner.caption', { course: env().studio.course }));
    await context.close();
  });

  it('[UD-006][PED-031] the planner’s «Lag frå mønster» opens the catalogue with its heading focused and in view', async () => {
    // Arrange: a phone's width, where the catalogue is far below the start of the guide
    const { app, browser } = env();
    const viewport = { width: 390, height: 844 };
    const context = await browser.newContext({ viewport, storageState: app.authorStorage });
    const page = await openStudioView(app, context, 'planner');
    // Act
    await tabTo(page, 'main table a[href*="#monsterkatalog"]');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/laeringsdesign\?[^#]*#monsterkatalog$/);
    // Assert: the heading has focus, and part of it is in the viewport, not under the sticky header
    await expect.poll(() => focusIs(page, '#monsterkatalog-overskrift'), { timeout: 15_000 }).toBe(true);
    const { stop } = await page.evaluate(inspectFocus);
    expect(stop?.inViewport).toBe(true);
    expect(stop?.coveredBy).toBeUndefined();
    await context.close();
  });

  it('[UD-006][PROD-007] Deling: a colleague is found and added by keyboard, and focus returns to the search field', async () => {
    // Arrange
    const { app, browser, studio } = env();
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await openStudioView(app, context, 'sharing');
    const { name, query } = studio.searchable;
    const search = '[role=tabpanel] input[type=search]';
    // Act
    await tabTo(page, search);
    await page.keyboard.type(query);
    await page.getByRole('button', { name: webText('sharing.addPerson', { name }) }).waitFor();
    await tabToText(page, webText('sharing.addPerson', { name }));
    await page.keyboard.press('Enter');
    // Assert
    await expect.poll(() => focusIs(page, search)).toBe(true);
    const announced = page.getByRole('status').filter({ hasText: webText('sharing.added', { name }) });
    await expect.poll(() => announced.count()).toBe(1);
    expect(await page.locator('[role=tabpanel] li').filter({ hasText: name }).count()).toBe(1);
    await context.close();
  });

  it('[UD-006][PROD-007] Deling: a co-author leaves by keyboard with «Fjern meg», and focus lands on the lasting message', async () => {
    // Arrange: a findable colleague's activity, with the run author as its co-author
    const { app, browser } = env();
    const contentId = await coAuthoredActivity(app, 'Eva Eigar');
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await openWebPage(context, app.base, `/aktivitet/${contentId}?fane=sharing`);
    await page
      .getByRole('button', { name: webText('sharing.removeSelf'), exact: true })
      .waitFor({ timeout: 15_000 });
    // Act
    await tabToText(page, webText('sharing.removeSelf'));
    await page.keyboard.press('Enter');
    // Assert: the message the button leaves behind has focus, and the change is announced
    const message = `${webText('sharing.removedSelf')} ${webText('sharing.backHome')}`;
    await expect.poll(() => focusedText(page)).toBe(message);
    const announced = page.getByRole('status').filter({ hasText: webText('sharing.removedSelf') });
    await expect.poll(() => announced.count()).toBe(1);
    const left = await app.tb.db.contentCollaborator.count({ where: { contentId, userId: app.authorId } });
    expect(left).toBe(0);
    await context.close();
  });

  it('[UD-006][MAPPE-001] /mappe: select all, remove all and the Markdown download by keyboard', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({ storageState: app.authorStorage, acceptDownloads: true });
    const page = await openWebPage(context, app.base, '/mappe');
    const picker = page.getByRole('group', { name: webText('mappe.pickerLegend') });
    // WHY: with no activity to choose, «all» and «none» would look alike and the journey would prove nothing.
    await picker.getByRole('checkbox').first().waitFor({ timeout: 15_000 });
    const total = await picker.getByRole('checkbox').count();
    const count = (n: number) => webText('mappe.pickerCount', { count: n, max: MAPPE_MAX_ACTIVITIES });
    const said = () => picker.getByRole('status').textContent();
    // Act and assert: choose every activity, then none, then every one again
    await tabToText(page, webText('mappe.selectAll'));
    await page.keyboard.press('Enter');
    await expect.poll(() => picker.locator('input:checked').count()).toBe(total);
    await expect.poll(said).toBe(count(total));
    await page.keyboard.press('Tab');
    expect(await focusedText(page)).toBe(webText('mappe.selectNone'));
    await page.keyboard.press('Enter');
    await expect.poll(said).toBe(count(0));
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect.poll(said).toBe(count(total));
    // Act and assert: the Markdown file
    await tabToText(page, webText('mappe.downloadMarkdown'));
    const download = page.waitForEvent('download', { timeout: 30_000 });
    await page.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toMatch(/^pedagogisk-mappe-\d{4}-\d{2}-\d{2}\.md$/);
    await expect.poll(() => page.getByRole('status').filter({ hasText: /\.md/ }).count()).toBe(1);
    await context.close();
  });
});
