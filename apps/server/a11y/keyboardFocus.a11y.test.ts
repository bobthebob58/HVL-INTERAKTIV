/**
 * Keyboard focus in the browser. On every page of the web app the first Tab reaches the skip link, which moves focus
 * to `main#main`. Tabbing all the way through every web view, and through the player of each content type in its
 * Canvas page, until focus comes back to the start or leaves the page, every element that receives focus shows a
 * focus indicator it does not show unfocused, is inside the viewport and is not covered (sticky header included,
 * checked with `elementFromPoint`), and focus never gets stuck on one element or in a cycle. A CoursePresentation
 * slide that takes focus shows the ring around the whole slide (HVL theme). A control page whose widgets each keep
 * focus for one press shows that the walk takes such a press for neither a cycle nor a missing ring.
 *
 * Spec: UD-004, UD-006, UD-011
 */
import { expect, it } from 'vitest';
import type { Page } from 'playwright-core';
import { describeA11y } from './support/a11ySuite.js';
import { CONTENT_TYPES, loadsByAddress, viewName, WEB_VIEWS } from './support/catalogue.js';
import { tabTo, walkFocus, type FocusStop } from './support/focusWalk.js';
import { playerFrame } from './support/pages.js';
import { openView } from './support/views.js';

const DESKTOP = { width: 1280, height: 800 };

/** The most Tab presses per walk: far more stops than any view has, so only a walk that never ends reaches it. */
const MAX_STOPS = { web: 150, player: 100 } as const;

/**
 * A page of four ringed buttons where B and C each keep focus for one Tab press, and a date field between C and D
 * whose day, month and year each take a press (the walk's control).
 */
const HOLDING_PAGE = `<!doctype html><html lang="en"><head><style>
:is(button, input):focus-visible { outline: 3px solid #004357; outline-offset: 2px; }</style></head><body>
<button>A</button><button>B</button><button>C</button><input type="date" aria-label="E"><button>D</button><script>
for (const button of [...document.querySelectorAll('button')].slice(1, 3)) {
  let held = false;
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && !held) { held = true; event.preventDefault(); }
  });
}</script></body></html>`;

/** The views a page load opens; the activity page's other tabs are the same page after a click. */
const LOADED_VIEWS = WEB_VIEWS.filter(loadsByAddress);

/** The stops that break UD-004, each with what is wrong. */
const problems = (stops: readonly FocusStop[]): string[] =>
  stops.flatMap((stop) => [
    ...(stop.indicator
      ? []
      : [`${stop.name}: no focus indicator${stop.unchanged ? ` (${stop.unchanged})` : ''}`]),
    ...(stop.inViewport ? [] : [`${stop.name}: outside the viewport`]),
    ...(stop.coveredBy ? [`${stop.name}: covered by ${stop.coveredBy}`] : []),
  ]);

/** Tabs through a page and prints where focus went. */
const walk = async (page: Page, label: string, maxStops: number) => {
  const result = await walkFocus(page, maxStops);
  const end = result.complete
    ? 'all the way round'
    : `not complete${result.trapped ? `, trapped on ${result.trapped}` : ''}`;
  console.info(
    `UD-004 ${label}: ${result.stops.length} focus stops, ${end}\n  ${result.stops.map((s) => s.name).join('\n  ')}`,
  );
  return result;
};

describeA11y('[UD-004] visible focus and [UD-006] keyboard access', (env) => {
  it.each(LOADED_VIEWS.map((view) => [viewName(view), view] as const))(
    '[UD-006] %s: the first Tab reaches the skip link, which moves focus to main',
    async (_name, view) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ viewport: DESKTOP, storageState: app.authorStorage });
      const page = await openView(app, context, view, { signedIn: true });
      // Act
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
      await page.keyboard.press('Enter');
      // Assert
      expect(first).toBe('Gå til hovudinnhaldet');
      await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('main');
      await context.close();
    },
  );

  it.each(WEB_VIEWS.map((view) => [viewName(view), view] as const))(
    '[UD-004] %s: every focused element is visible and not covered',
    async (name, view) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ viewport: DESKTOP, storageState: app.authorStorage });
      const page = await openView(app, context, view, { signedIn: true });
      // Act
      const { stops, trapped, complete } = await walk(page, name, MAX_STOPS.web);
      // Assert
      expect(trapped).toBeUndefined();
      expect(complete).toBe(true);
      expect(stops.length).toBeGreaterThan(2);
      expect(problems(stops)).toEqual([]);
      await context.close();
    },
  );

  it.each(CONTENT_TYPES)(
    '[UD-004] %s in Canvas: every focused element is visible and not covered',
    async (type) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ viewport: DESKTOP });
      const page = await openView(app, context, { kind: 'canvas' }, { contentId: app.ids.get(type) ?? '' });
      // Act
      const { stops, trapped, complete } = await walk(page, `${type} in Canvas`, MAX_STOPS.player);
      // Assert
      expect(trapped).toBeUndefined();
      expect(complete).toBe(true);
      expect(stops.some((stop) => stop.name.includes(' in IFRAME'))).toBe(true);
      expect(problems(stops)).toEqual([]);
      await context.close();
    },
  );

  it('[UD-006] control: widgets and a date field that keep focus for some Tab presses are neither a cycle nor unringed', async () => {
    // Arrange: four buttons and a date field with the HVL ring; B and C each keep focus for one press, as a composite
    // widget may, and the date field for one press per part
    const { browser } = env();
    const context = await browser.newContext({ viewport: DESKTOP });
    const page = await context.newPage();
    await page.setContent(HOLDING_PAGE);
    // Act
    const result = await walkFocus(page, 20);
    // Assert
    expect(result.trapped).toBeUndefined();
    expect(result.complete).toBe(true);
    expect(result.stops.map((stop) => stop.name)).toEqual([
      ...['A', 'B', 'C'].map((n) => `BUTTON "${n}"`),
      'INPUT[type=date] "E"',
      'BUTTON "D"',
    ]);
    expect(problems(result.stops)).toEqual([]);
    await context.close();
  });

  it('[UD-004] a CoursePresentation slide that has focus shows the two-tone ring around the slide', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({ viewport: DESKTOP });
    const contentId = app.ids.get('H5P.CoursePresentation') ?? '';
    const player = await playerFrame(await openView(app, context, { kind: 'canvas' }, { contentId }));
    // Act
    await tabTo(player.page(), '.h5p-slide > [role=document]');
    const ring = await player
      .locator('.h5p-slide.h5p-current')
      .evaluate((slide) => [getComputedStyle(slide).outline, getComputedStyle(slide).boxShadow]);
    // Assert
    expect(ring).toEqual(['rgb(0, 67, 87) solid 3px', 'rgb(255, 255, 255) 0px 0px 0px 5px inset']);
    await context.close();
  });
});
