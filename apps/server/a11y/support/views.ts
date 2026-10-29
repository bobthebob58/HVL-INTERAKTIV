/**
 * views — opens one view of the catalogue (./catalogue.ts) in a browser context, and puts a question on screen into
 * its answered state.
 *
 * Why: the axe, reflow, keyboard, target-size and network suites open the same views; one function keeps how they
 *      are opened (and what each waits for) identical. Feedback states are styled by the HVL theme (UD-003, UD-011),
 *      so the suites check them answered as well as fresh. QuestionSet, InteractiveBook and BranchingScenario open
 *      on an intro screen with one button; without leaving it, their questions (and QuestionSet's progress dots)
 *      would never be checked. The question of a CoursePresentation is on its second slide, InteractiveVideo's
 *      appears while the video plays, DragText is answered by dropping a word, and ImageHotspots shows its text in
 *      a popup: pressing a check button that is on screen reached none of these states.
 * Spec: UD-030, UD-003, UD-011, UD-005
 * Invariants:
 *   - An activity view opens the author's MultiChoice draft unless a content ID is given; the Canvas view is a
 *     student's launch of the published MultiChoice unless a content ID is given.
 *   - `startAndAnswer` brings each type to the state `ANSWERED_STATE` names: it leaves an intro screen, moves to the
 *     slide (CoursePresentation's next button with a real pointer click; reflowAndMotion.a11y.test.ts checks every
 *     pixel of its footer) or video moment with a question, drops a DragText word by keyboard (UD-005's
 *     alternative) or opens a hotspot, answers (the first option, or text in the first fields), presses the check
 *     button with a real pointer click (Playwright refuses a control something lies over); it fails when
 *     that state does not appear, so a suite never checks a fresh activity twice and calls it answered. It does not
 *     wait for transitions to end (`waitForStillness` does), so the reduced-motion check sees what still moves.
 * Collaborators: ./pages.ts, ./catalogue.ts, ./studioViews.ts (the studio's seeded views),
 *   ../../test/support/realWebApp.ts.
 * Tests: apps/server/a11y/axeContentTypes.a11y.test.ts and the other suites in apps/server/a11y/.
 */
import type { BrowserContext, Frame, Page } from 'playwright-core';
import type { RealWebApp, UiLocale } from '../../test/support/realWebApp.js';
import type { ContentType, WebView } from './catalogue.js';
import { editorFrame, openActivityTab, openLaunch, openWebPage } from './pages.js';
import { openStudioView } from './studioViews.js';

/** Options for `openView`. */
export interface ViewOptions {
  /** The activity of an activity or Canvas view. */
  readonly contentId?: string;
  /** Language of a Canvas launch. */
  readonly locale?: UiLocale;
  /** Whether the context is signed in; `/aktivitet/ny` then waits for H5P's content-type list, a pattern page for
   * its create form. */
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
  if (view.kind === 'studio') return openStudioView(app, context, view.view, options.signedIn ?? true);
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

/** What shows once `startAndAnswer` has answered (or, without a question, opened) each type's first task. */
export const ANSWERED_STATE: Readonly<Record<ContentType, string>> = {
  'H5P.Blanks': '.hvl-feedback-sr',
  'H5P.BranchingScenario': '.h5p-current-screen:not(.h5p-start-screen)',
  'H5P.Column': '.hvl-feedback-sr',
  'H5P.CoursePresentation': '.hvl-feedback-sr',
  'H5P.DragText': '.hvl-feedback-sr',
  'H5P.ImageHotspots': '.h5p-image-hotspot-popup',
  'H5P.InteractiveBook': '.hvl-feedback-sr',
  'H5P.InteractiveVideo': '.hvl-feedback-sr',
  'H5P.MultiChoice': '.hvl-feedback-sr',
  'H5P.QuestionSet': '.hvl-feedback-sr',
};

/** Clicks the first visible element of `selector` in a frame, if there is one; true when it did. */
async function clickIfShown(frame: Frame, selector: string): Promise<boolean> {
  const target = frame.locator(selector).filter({ visible: true }).first();
  if ((await target.count()) === 0) return false;
  await target.click();
  return true;
}

/** Moves to the type's first task: the slide with a question, the video's question, or (by keyboard) a word in a gap. */
async function reachTask(frame: Frame, type: ContentType): Promise<void> {
  if (type === 'H5P.CoursePresentation') {
    const checkShown = () => frame.locator(CHECK_BUTTON).filter({ visible: true }).count();
    const next = frame.locator('.h5p-theme-next').first();
    for (let i = 0; i < 3 && (await checkShown()) === 0; i += 1) {
      // WHY: a real pointer click, which Playwright refuses while something lies over the button's centre; the HVL
      // theme gives the footer room of its own (hvl-h5p-targets.css), and reflowAndMotion.a11y.test.ts checks that a
      // pointer reaches all of every footer control at phone sizes.
      await next.click();
      await frame.waitForTimeout(500);
    }
  }
  if (type === 'H5P.InteractiveVideo') {
    await clickIfShown(frame, '.h5p-splash-wrapper, .h5p-control.h5p-play');
    const question = frame.locator('.h5p-interaction .h5p-interaction-button').filter({ visible: true });
    await question.first().click({ timeout: 20_000 });
  }
  if (type === 'H5P.DragText') {
    await frame.locator('.h5p-drag-text .h5p-draggable').first().focus();
    await frame.page().keyboard.press('Space');
    await frame.locator('.h5p-drag-text [aria-dropeffect]').first().focus();
    await frame.page().keyboard.press('Space');
  }
  if (type === 'H5P.ImageHotspots') await frame.locator('.h5p-image-hotspot').first().click();
}

/**
 * Brings the activity in a player frame to its answered state (see `ANSWERED_STATE`): leaves its intro screen, moves
 * to its first task, answers it and presses its check button.
 * @param frame - The H5P player's frame.
 * @param type - The activity's main library.
 * @throws Error when the answered state does not appear.
 */
export async function startAndAnswer(frame: Frame, type: ContentType): Promise<void> {
  if (await clickIfShown(frame, START_BUTTON)) await frame.waitForTimeout(500);
  await reachTask(frame, type);
  const check = frame.locator(CHECK_BUTTON).filter({ visible: true }).first();
  if ((await check.count()) > 0) {
    await clickIfShown(frame, '.h5p-answer');
    const fields = frame.locator('.h5p-text-input').filter({ visible: true });
    for (let i = 0; i < Math.min(await fields.count(), 2); i += 1) await fields.nth(i).fill('svar');
    await check.click();
  }
  await frame
    .locator(ANSWERED_STATE[type])
    .first()
    .waitFor({ state: 'attached', timeout: 10_000 })
    .catch(() => {
      throw new Error(`${type} did not reach its answered state (${ANSWERED_STATE[type]})`);
    });
  await frame.waitForTimeout(300);
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
