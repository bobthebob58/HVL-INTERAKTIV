/**
 * studioViews — opens the læringsdesign studio's views (S5) in the states the seed (./studioSeed.ts) gives them: a
 * pattern page, the planner of a course with gaps, `/mappe` after a word count, an activity's **Læringsdesign** and
 * **Deling** tabs, and a copy's page with its attribution sign; each waits until its content is there (the planner
 * until its table, both kinds of gap and the activity without tags show; the copy until its sign shows; a pattern
 * page until its create form or, signed out, its sign-in prompt shows).
 *
 * Why: the studio's pages fetch their data in the browser after hydration, and some of their states exist only after
 *      a step (the planner needs `?emne=`, the word count needs a choice). Every suite that walks ./catalogue.ts's
 *      views opens them through this one function, so the axe, keyboard, reflow, spacing and language checks see the
 *      same states (UD-030).
 * Spec: UD-030, PED-010, PED-030, PED-031, PROD-007, MAPPE-001
 * Invariants:
 *   - Controls and messages are found by structure or by the web app's own Nynorsk texts
 *     (../../test/support/webAppTexts.ts), never by ALU's content texts.
 *   - The seed of the running server is looked up by the app (`studioSeedOf`); a view opened before seeding throws.
 * Collaborators: ./studioSeed.ts, ./pages.ts, ./views.ts, ./catalogue.ts, ../../test/support/webAppTexts.ts.
 * Tests: apps/server/a11y/axeStudioViews.a11y.test.ts and every suite that walks ./catalogue.ts's views.
 */
import type { BrowserContext, Page } from 'playwright-core';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import type { StudioView } from './catalogue.js';
import { openActivityTab, openWebPage } from './pages.js';
import { seedStudio, type StudioSeed } from './studioSeed.js';
import { webText, webTextPattern } from '../../test/support/webAppTexts.js';

const seeds = new WeakMap<RealWebApp, StudioSeed>();

/**
 * Seeds the studio data of a running server once and remembers it for `studioSeedOf`.
 * @param app - The running server.
 * @returns The seed.
 */
export async function seedStudioOnce(app: RealWebApp): Promise<StudioSeed> {
  const known = seeds.get(app);
  if (known) return known;
  const seed = await seedStudio(app);
  seeds.set(app, seed);
  return seed;
}

/**
 * The seed of a running server.
 * @param app - The running server.
 * @returns What ./studioSeed.ts made for it.
 * @throws Error when the server was not seeded (./a11ySuite.ts seeds it before the tests).
 */
export function studioSeedOf(app: RealWebApp): StudioSeed {
  const seed = seeds.get(app);
  if (!seed) throw new Error('the studio data is not seeded for this server');
  return seed;
}

/** The text of the word count once the server has counted (within or over the limits). */
const COUNTED = new RegExp(
  `${webTextPattern('mappe.wordCountWithin').source}|${webTextPattern('mappe.wordCountOver').source}`,
);

/** Chooses every activity on `/mappe` and waits for the word count of the preview. */
async function previewMappe(page: Page): Promise<void> {
  await page.getByRole('button', { name: webText('mappe.selectAll'), exact: true }).click();
  await page.locator('main [role=status]').filter({ hasText: COUNTED }).waitFor({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Opens a studio view and waits until its content is there.
 * @param app - The running server, seeded.
 * @param context - The browser context; signed in as the author for every view but a signed-out pattern page.
 * @param view - Which view.
 * @param signedIn - Whether the context is signed in (the pattern page then shows its create form).
 * @returns The page.
 */
export async function openStudioView(
  app: RealWebApp,
  context: BrowserContext,
  view: StudioView,
  signedIn = true,
): Promise<Page> {
  const seed = studioSeedOf(app);
  const open = (path: string) => openWebPage(context, app.base, path);
  /** Waits until the page shows one of the web app's own texts (any placeholder values). */
  const shows = (page: Page, key: string) =>
    page.locator('main').getByText(webTextPattern(key)).first().waitFor({ timeout: 15_000 });
  if (view === 'copy') {
    const page = await openActivityTab(context, app.base, seed.copyId, 'play');
    // WHY: the view is the copy's page with its attribution sign; a page without it would be scanned for nothing.
    await shows(page, 'sharing.attribution');
    return page;
  }
  if (view === 'pattern') {
    const page = await open(`/laeringsdesign/monster/${encodeURIComponent(seed.patternId)}`);
    if (signedIn) await page.locator('main form button[type=submit]').waitFor({ timeout: 15_000 });
    // WHY: the pattern and the session load in the browser; a scan of «Hentar …» would check nothing of the page.
    else await shows(page, 'patterns.signedOut');
    return page;
  }
  if (view === 'planner') {
    const page = await open(`/laeringsdesign/planlegg?emne=${encodeURIComponent(seed.course)}`);
    await page.locator('main table').waitFor({ timeout: 15_000 });
    // WHY: the seed's plan has both kinds of gap and an activity without tags; the view is checked with all three.
    for (const key of ['planner.gapNoEtterarbeid', 'planner.gapEmptyPhase', 'planner.untaggedIntro'])
      await shows(page, key);
    return page;
  }
  if (view === 'mappePreview') {
    const page = await open('/mappe');
    await previewMappe(page);
    return page;
  }
  const tab = view === 'learningDesign' ? 'learning-design' : 'sharing';
  const page = await open(`/aktivitet/${encodeURIComponent(seed.designedId)}?fane=${tab}`);
  // WHY: the tab's own requests (the design, the co-authors, the bank listing) answer after the page's; the form or
  // the owner's people search shows once they have.
  const ready = view === 'learningDesign' ? '[role=tabpanel] form' : '[role=tabpanel] input[type=search]';
  await page.locator(ready).waitFor({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  return page;
}
