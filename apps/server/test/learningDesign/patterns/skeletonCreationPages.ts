/**
 * skeletonCreationPages — drives the editor and player pages in Chromium for probe P1: opens an activity in the
 * editor, saves it once without changes and returns what the editor sent; opens it in the player and returns what
 * the learner meets.
 *
 * Why: P1 must show that an activity created on the server opens and saves in H5P's editor without an error and
 *      plays without a JavaScript error (D-084, D-085), and what the editor would add to it.
 * Spec: PED-010, PROD-001
 * Invariants:
 *   - Every console error, page error and failed request is reported, except the outside frames the strict page
 *     policy refuses (D-070), which are listed apart; each page is closed before returning.
 *   - No step waits a fixed time for H5P: the editor counts as built and the player as rendered only once they have
 *     settled (./skeletonCreationSettling.ts). The one fixed wait, before a page closes, only proves that no late
 *     error comes.
 * Collaborators: ./skeletonCreation.browser.int.test.ts, ./skeletonCreationSettling.ts,
 *   ../../support/httpTestbed.ts (actor headers).
 * Tests: apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts
 */
import type { Browser, Page } from 'playwright-core';
import { t } from '../../../src/i18n/translate.js';
import type { TestActor } from '../../support/httpTestbed.js';
import { builtEditor, LATE_ERROR_WINDOW_MS, SETTLE, settled } from './skeletonCreationSettling.js';

/** A third-party frame the policy refused, as the browser reports it. */
const REFUSED_FRAME = /^Refused to frame '(https?:\/\/[^']+)'/;

/** What the browser reported on one page. */
export interface PageReport {
  readonly problems: string[];
  /** Outside pages the strict policy kept out (DATA-011). */
  readonly refusedFrames: string[];
}

/** One unchanged save in the editor. */
export interface EditorSave extends PageReport {
  /** HTTP status of the save. */
  readonly status: number;
  /** The editor page's status line after the save. */
  readonly statusText: string | null;
  /** The parameters the editor sent. */
  readonly params: object;
}

/** What the player showed. */
export interface PlayerView extends PageReport {
  readonly status: number;
  /** Playwright's ARIA snapshot of the activity. */
  readonly tree: string;
  /** `<img>` elements in the activity that have no `alt` attribute (their `src`). */
  readonly imagesWithoutAlt: string[];
  /** `<img>` elements marked decorative with `alt=""` (their `src`), e.g. by the page repairs (D-080). */
  readonly decorativeImages: string[];
}

async function openAs(browser: Browser, actor: TestActor): Promise<{ page: Page } & PageReport> {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ [actor.header[0]]: actor.header[1] });
  const problems: string[] = [];
  const refusedFrames: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const refused = REFUSED_FRAME.exec(m.text())?.[1];
    if (refused) refusedFrames.push(refused);
    else problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
  page.on('response', (r) => void (r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`)));
  return { page, problems, refusedFrames };
}

/**
 * Opens the editor page of an activity, waits until H5P has built the form, and presses save once.
 * @param browser - The running Chromium.
 * @param base - The server's base URL.
 * @param actor - The author.
 * @param contentId - The activity.
 * @returns The save and the problems seen.
 */
export async function saveUnchangedInEditor(
  browser: Browser,
  base: string,
  actor: TestActor,
  contentId: string,
): Promise<EditorSave> {
  const { page, problems, refusedFrames } = await openAs(browser, actor);
  await page.goto(`${base}/h5p/edit/${contentId}`);
  await builtEditor(page);
  const request = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().endsWith(`/h5p/content/${contentId}`),
  );
  const response = page.waitForResponse((r) => r.url().endsWith(`/h5p/content/${contentId}`));
  await page.click('#hvl-editor-save');
  const body = (await request).postDataJSON() as { params: { params: object } };
  const status = (await response).status();
  await page.waitForFunction(
    (saving) => document.querySelector('#hvl-editor-status')?.textContent !== saving,
    t('page.editor.saving', {}, 'nn'),
  );
  const statusText = await page.textContent('#hvl-editor-status');
  // WHY: absence: an error the editor raises after the save must still reach `problems`.
  await page.waitForTimeout(LATE_ERROR_WINDOW_MS);
  await page.close();
  return { problems, refusedFrames, status, statusText, params: body.params.params };
}

/**
 * Opens the player page of an activity and waits until H5P has started it and what it shows has settled.
 * @param browser - The running Chromium.
 * @param base - The server's base URL.
 * @param actor - Who views it.
 * @param contentId - The activity.
 * @returns What the page showed and the problems seen.
 */
export async function viewInPlayer(
  browser: Browser,
  base: string,
  actor: TestActor,
  contentId: string,
): Promise<PlayerView> {
  const { page, problems, refusedFrames } = await openAs(browser, actor);
  const response = await page.goto(`${base}/h5p/play/${contentId}`);
  await page.waitForFunction(
    () => (window as unknown as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length,
    undefined,
    { timeout: SETTLE.timeoutMs },
  );
  const read = async () => ({
    tree: await page.locator('.h5p-content').ariaSnapshot(),
    imagesWithoutAlt: await page
      .locator('.h5p-content img:not([alt])')
      .evaluateAll((images) => images.map((image) => image.getAttribute('src') ?? '')),
    decorativeImages: await page
      .locator('.h5p-content img[alt=""]')
      .evaluateAll((images) => images.map((image) => image.getAttribute('src') ?? '')),
  });
  // WHY: a content type goes on rendering after H5P has created its instance (a book its pages, a scenario its
  // screens), so the view is read once it has stopped changing.
  await settled(read, 'The player');
  // WHY: absence: an error the player raises after rendering must still reach `problems`; the view is read after it.
  await page.waitForTimeout(LATE_ERROR_WINDOW_MS);
  const view = await read();
  await page.close();
  return { problems, refusedFrames, status: response?.status() ?? 0, ...view };
}
