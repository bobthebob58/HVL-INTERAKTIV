/**
 * learnerStateAfterEditPlayer — plays an activity as the learner in Chromium until H5P has saved the state, then
 * applies each edit, puts the saved row back and reads what the resumed learner sees: errors, selected options,
 * typed blanks and the state the activity resumed into.
 *
 * Why: probe P3 (PROD-013, D-093) must show what a resumed learner meets after each kind of edit. A crash shows up
 *      as a page error and no running instance; a wrong restore as an option or text the learner never chose; an
 *      ignored state as an empty activity.
 * Spec: PROD-013, H5P-005
 * Invariants:
 *   - The player is the production page `/h5p/play/:id`; the state is saved by H5P's own autosave (D-037).
 *   - Every edit is resumed from the same saved row, never from the row an earlier resume wrote.
 * Collaborators: ./learnerStateAfterEditBench.ts, ./learnerStateAfterEditLearners.ts, ../../support/browser.ts.
 * Tests: ./learnerStateAfterEdit.browser.int.test.ts, ./learnerStateAfterEditComposite.browser.int.test.ts,
 *   ./learnerStateAfterEditNavigation.browser.int.test.ts, ./learnerStateAfterEditPaths.browser.int.test.ts
 */
import type { Browser, Page } from 'playwright-core';
import type { BenchActivity, StateBench, StateRowSnapshot } from './learnerStateAfterEditBench.js';
import type { LearnerScript } from './learnerStateAfterEditLearners.js';

/** What a learner sees after the page has started. */
export interface ResumedView {
  /** Whether H5P created the activity at all (false after a crash in a constructor). */
  readonly started: boolean;
  /** The text of every selected multiple-choice option, in document order. */
  readonly selected: string[];
  /** The value of every text blank, in document order. */
  readonly typed: string[];
  /** The word in each drag-text drop zone ('' when empty), in document order. */
  readonly placed: string[];
  /** The visible text of the activity, spaces collapsed. */
  readonly shown: string;
  /** `getCurrentState()` of the main instance right after the resume, or null without one. */
  readonly state: unknown;
  /** Uncaught exceptions and console errors, in order. */
  readonly errors: string[];
}

/** The saved state and what each edit did to its resume. */
export interface EditProbe {
  /** The parsed main state H5P saved after the learner's input. */
  readonly saved: unknown;
  /** The activity's state rows as H5P left them. */
  readonly rows: readonly StateRowSnapshot[];
  /** Case name → what the learner sees after that edit. */
  readonly resumed: Readonly<Record<string, ResumedView>>;
}

/**
 * Opens the player as the learner and waits until H5P has started the activity or failed.
 * @param browser - The running Chromium.
 * @param bench - The bench with the server and the learner.
 * @param contentId - The activity.
 * @returns The page and the list its errors are added to.
 */
export async function openAsLearner(
  browser: Browser,
  bench: StateBench,
  contentId: string,
): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => void (m.type() === 'error' && errors.push(`console: ${m.text()}`)));
  await page.setExtraHTTPHeaders({ [bench.learner.header[0]]: bench.learner.header[1] });
  await page.goto(`${bench.base}/h5p/play/${contentId}`);
  // WHY: a constructor that throws leaves H5P.instances empty, so wait for either outcome, not for the instance.
  await page
    .waitForFunction(
      () => (window as unknown as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length,
      {
        timeout: 8_000,
      },
    )
    .catch(() => undefined);
  // WHY: some types attach their children after the main constructor; give them a moment to settle.
  await page.waitForTimeout(500);
  return { page, errors };
}

/**
 * Waits until H5P's autosave (every 5 s, D-037) has stored a main state that passes `saved`.
 * @param bench - The bench.
 * @param contentId - The activity.
 * @param saved - Tells whether the parsed state holds the learner's answers yet.
 * @returns Every state row of the activity, as stored.
 * @throws Error after 15 s without such a row.
 */
export async function savedStateRows(
  bench: StateBench,
  contentId: string,
  saved: (state: unknown) => boolean,
): Promise<StateRowSnapshot[]> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const rows = await bench.stateRows(contentId);
    const main = rows.find((row) => row.subContentId === '0' && row.dataType === 'state');
    if (main && saved(JSON.parse(String(main.data)))) return rows;
    if (Date.now() > deadline) throw new Error(`no matching saved state: ${JSON.stringify(rows)}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const readView = (page: Page): Promise<Omit<ResumedView, 'errors'>> =>
  page.evaluate(() => {
    const h5p = (window as unknown as { H5P?: { instances?: { getCurrentState?: () => unknown }[] } }).H5P;
    const main = h5p?.instances?.[0];
    const text = (element: Element) => (element.textContent ?? '').trim();
    const chosen = '.h5p-answer[aria-checked="true"] .h5p-alternative-inner';
    return {
      started: Boolean(main),
      selected: [...document.querySelectorAll(chosen)].map(text),
      typed: [...document.querySelectorAll<HTMLInputElement>('.h5p-text-input')].map((input) => input.value),
      placed: [...document.querySelectorAll('.h5p-dropzone')].map((zone) => {
        const word = zone.querySelector('.h5p-draggable')?.cloneNode(true) as Element | undefined;
        word?.querySelectorAll('.h5p-hidden-read').forEach((hidden) => hidden.remove());
        return word ? text(word) : '';
      }),
      shown: (document.querySelector<HTMLElement>('.h5p-content')?.innerText ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
      state: main?.getCurrentState ? JSON.parse(JSON.stringify(main.getCurrentState() ?? null)) : null,
    };
  });

/**
 * Resumes the activity as the learner, reads the view and closes the page.
 * @param browser - The running Chromium.
 * @param bench - The bench.
 * @param contentId - The activity.
 * @returns What the learner sees.
 */
export async function resumeAndRead(
  browser: Browser,
  bench: StateBench,
  contentId: string,
): Promise<ResumedView> {
  const { page, errors } = await openAsLearner(browser, bench, contentId);
  const view = await readView(page);
  // WHY: closing without beforeunload keeps H5P's unload save from rewriting the row the next case restores.
  await page.close({ runBeforeUnload: false });
  return { ...view, errors };
}

/**
 * Lets the learner answer, waits for H5P's save, then saves each edit with the learner's row kept and resumes.
 * @param browser - The running Chromium.
 * @param bench - The bench.
 * @param activity - The activity, with the parameters the learner plays.
 * @param learner - What the learner does.
 * @param edits - Case name → the edited parameters; they are applied in order, each to the original.
 * @returns The saved state and the resumed views.
 * @throws Error when the learner's input never reaches a saved row.
 * @example
 *   const probe = await probeEdits(browser(), bench, mc, MULTI_CHOICE, { textOnly: edited(mc.params, …) });
 */
export async function probeEdits(
  browser: Browser,
  bench: StateBench,
  activity: BenchActivity,
  learner: LearnerScript,
  edits: Readonly<Record<string, object>>,
): Promise<EditProbe> {
  const { page } = await openAsLearner(browser, bench, activity.id);
  await learner.play(page);
  const rows = await savedStateRows(bench, activity.id, learner.saved);
  await page.close({ runBeforeUnload: false });
  const resumed: Record<string, ResumedView> = {};
  for (const [name, params] of Object.entries(edits)) {
    await bench.saveParams(activity, params);
    await bench.restoreRows(activity.id, rows);
    resumed[name] = await resumeAndRead(browser, bench, activity.id);
  }
  const main = rows.find((row) => row.subContentId === '0');
  return { saved: JSON.parse(String(main?.data)), rows, resumed };
}

/**
 * Every resumed case reduced to whether it started, the parts of the view a test compares, and its errors.
 * @param probe - From `probeEdits`.
 * @param pick - The parts of the view to keep, e.g. the selected options.
 * @returns Case name → `{ started, ...picked, errors }`.
 */
export const outcomes = (probe: EditProbe, pick: (view: ResumedView) => object): Record<string, object> =>
  Object.fromEntries(
    Object.entries(probe.resumed).map(([name, r]) => [
      name,
      { started: r.started, ...pick(r), errors: r.errors },
    ]),
  );
