/**
 * views — opens one view of the catalogue (./catalogue.ts) in a browser context, and puts a question on screen into
 * its answered state.
 *
 * Why: the axe, reflow, keyboard, target-size and network suites open the same views; one function keeps how they
 *      are opened (and what each waits for) identical. Feedback states are styled by the HVL theme (UD-003, UD-011),
 *      so the suites check them answered as well as fresh. QuestionSet, InteractiveBook and BranchingScenario open
 *      on an intro screen with one button; without leaving it, their questions (and QuestionSet's progress dots)
 *      would never be checked.
 * Spec: UD-030, UD-003, UD-011, UD-005
 * Invariants:
 *   - An activity view opens the author's MultiChoice draft unless a content ID is given; the Canvas view is a
 *     student's launch of the published MultiChoice unless a content ID is given.
 *   - `startAndAnswer` presses an intro screen's start button if one shows, then picks the first option or types
 *     into the first fields and presses the visible check button; it never asserts what H5P shows, so it works for
 *     every type. It does not wait for transitions to end (`waitForStillness` does), so the reduced-motion check
 *     sees what still moves.
 * Collaborators: ./pages.ts, ./catalogue.ts, ../../test/support/realWebApp.ts.
 * Tests: apps/server/a11y/axeContentTypes.a11y.test.ts and the other suites in apps/server/a11y/.
 */
import type { BrowserContext, Frame, Page } from 'playwright-core';
import type { RealWebApp, UiLocale } from '../../test/support/realWebApp.js';
import type { WebView } from './catalogue.js';
import { editorFrame, openActivityTab, openLaunch, openWebPage } from './pages.js';

/** Options for `openView`. */
export interface ViewOptions {
  /** The activity of an activity or Canvas view. */
  readonly contentId?: string;
  /** Language of a Canvas launch. */
  readonly locale?: UiLocale;
  /** Whether the context is signed in; `/aktivitet/ny` then waits for H5P's content-type list. */
  readonly signedIn?: boolean;
}

/**
 * Opens a view and waits until its content is there.
 * @param app - The running server.
 * @param context - The browser context (signed in or not).
 * @param view - What to open.
 * @param options - Activity, launch language and whether the context is signed in.
 * @returns The page.
 */
export async function openView(
  app: RealWebApp,
  context: BrowserContext,
  view: WebView,
  options: ViewOptions = {},
): Promise<Page> {
  if (view.kind === 'activity') {
    return openActivityTab(context, app.base, options.contentId ?? app.draftId, view.tab);
  }
  if (view.kind === 'canvas') {
    const contentId = options.contentId ?? app.ids.get('H5P.MultiChoice') ?? '';
    return openLaunch(context, app, contentId, options.locale ? { locale: options.locale } : {});
  }
  const page = await openWebPage(context, app.base, view.path);
  if (view.path === '/aktivitet/ny' && options.signedIn) await editorFrame(page);
  return page;
}

/** The check buttons of JoubelUI (MultiChoice, Blanks, QuestionSet) and of Daylight (DragText). */
const CHECK_BUTTON = '.h5p-question-check-answer, .h5p-theme-check';

/** The buttons that leave an intro screen: QuestionSet's and InteractiveBook's Daylight call-to-action, and
 * BranchingScenario's start button. */
const START_BUTTON =
  '.h5p-theme-primary-cta.h5p-theme-quiz, .h5p-theme-primary-cta.h5p-theme-book, .h5p-start-button';

/**
 * Leaves the intro screen of the activity in a player frame (if it has one), then answers the question on screen
 * and presses its check button (if it has one).
 * @param frame - The H5P player's frame.
 * @returns True when the activity changed state (started, answered or both), so it is worth checking again.
 */
export async function startAndAnswer(frame: Frame): Promise<boolean> {
  const start = frame.locator(START_BUTTON).filter({ visible: true }).first();
  const started = (await start.count()) > 0;
  if (started) {
    await start.click();
    await frame.waitForTimeout(500);
  }
  const check = frame.locator(CHECK_BUTTON).filter({ visible: true }).first();
  if ((await check.count()) === 0) return started;
  const option = frame.locator('.h5p-answer').filter({ visible: true }).first();
  if ((await option.count()) > 0) await option.click();
  const fields = frame.locator('.h5p-text-input').filter({ visible: true });
  for (let i = 0; i < Math.min(await fields.count(), 2); i += 1) await fields.nth(i).fill('svar');
  await check.click();
  await frame.waitForTimeout(300);
  return true;
}

/**
 * Waits until no finite CSS animation or transition runs in a frame, so a scan sees the state a person reads, not a
 * slide half-way in (BranchingScenario's screens slide). Never used by the reduced-motion check, which must see
 * whatever still moves.
 * @param frame - The H5P player's frame.
 * @throws Error when something still moves after 10 s.
 */
export async function waitForStillness(frame: Frame): Promise<void> {
  await frame.waitForFunction(
    () =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
    undefined,
    { timeout: 10_000 },
  );
}

/**
 * Closes the guided tour H5P's BranchingScenario editor opens with, one "I got it" at a time.
 * @param frame - H5P's editor iframe.
 * @returns How many tour steps were closed.
 */
export async function closeBranchingTour(frame: Frame): Promise<number> {
  const button = frame.locator('.tour-button').filter({ visible: true }).first();
  let closed = 0;
  while (closed < 10 && (await button.count()) > 0) {
    await button.click();
    closed += 1;
  }
  return closed;
}
