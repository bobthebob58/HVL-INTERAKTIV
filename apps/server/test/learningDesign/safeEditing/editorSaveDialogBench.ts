/**
 * editorSaveDialogBench — probe P7's portal setup: the real H5P runtime with the real content types, one activity
 * of the author's in the editor page, and the probe's dialog script loaded into that page.
 *
 * Why: the dialog must be checked on the page it will live on, with H5P's editor iframe, H5P's scripts and
 *      stylesheets, the HVL theme and the strict page policy (D-070) all present; a stand-alone page would prove
 *      nothing about any of them.
 * Spec: PROD-013, UD-030
 * Invariants:
 *   - The probe never saves: `armOn` swallows the save button's click; `saves` lists any save request so a test
 *     can prove it.
 *   - `close` removes every row and object the bench made (the testbed's own cleanup) and stops the server.
 * Collaborators: ../../support/httpTestbed.ts, ../../support/realPackages.ts, ../../support/loopbackServers.ts,
 *   ./editorSaveDialogPage.ts.
 * Tests: ./editorSaveDialog.browser.int.test.ts, ./editorSaveDialogLook.browser.int.test.ts,
 *   ./editorSaveDialogCanvas.browser.int.test.ts (the editor page framed on our origin)
 */
import { join } from 'node:path';
import type { Browser, Frame, Locator, Page } from 'playwright-core';
import { expect } from 'vitest';
import { closeLoopbackServers, listenOnLoopback } from '../../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed } from '../../support/httpTestbed.js';
import { REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { loadProbeScript, SAVE_CHOICE_TEXTS, withProbeFiles } from './editorSaveDialogPage.js';

/** The running portal app with one activity to edit. */
export interface DialogBench {
  readonly tb: HttpTestbed;
  /** `http://127.0.0.1:<port>`. */
  readonly base: string;
  /** The `x-test-actor` header of the activity's author. */
  readonly authorHeader: readonly [string, string];
  readonly contentId: string;
  close(): Promise<void>;
}

/** An editor page with the probe script loaded. */
export interface ProbePage {
  readonly page: Page;
  /** The editor page's own document (the top frame here). */
  readonly frame: Frame;
  /** The page's `Content-Security-Policy` header. */
  readonly csp: string;
  /** Save requests the page sent (`PUT`/`POST` to `/h5p/content`); the probe must send none. */
  readonly saves: string[];
  /** Closes the page's own browser context. */
  close(): Promise<void>;
}

/** Probe options the stand-in script understands (./editorSaveDialogClient.js). */
export interface ProbeOptions {
  readonly wrapTab?: boolean;
  readonly guardFrameFocus?: boolean;
  readonly focusVisible?: boolean;
  readonly disableOpener?: boolean;
  readonly restoreFocus?: boolean;
}

/**
 * Starts the app with the real packages and imports H5P.Column's example as an author's draft.
 * @returns The bench; call `close()` in `afterAll`.
 */
export async function openDialogBench(): Promise<DialogBench> {
  const tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
  const author = await tb.actor('author');
  const contentId = await tb.importPackage(author, join(REAL_PACKAGES_DIR, 'H5P.Column.h5p'));
  const base = await listenOnLoopback(withProbeFiles(tb.app));
  return {
    tb,
    base,
    authorHeader: author.header,
    contentId,
    close: async () => {
      await closeLoopbackServers();
      await tb.close();
    },
  };
}

/**
 * Opens the activity in the editor page as its author, waits for H5P's editor, and loads the probe script.
 * @param browser - The running Chromium.
 * @param bench - The bench.
 * @returns The page with the probe loaded.
 * @throws Error when the probe script did not run.
 */
export async function openEditorWithProbe(browser: Browser, bench: DialogBench): Promise<ProbePage> {
  // WHY: @axe-core/playwright refuses a page from `browser.newPage()`; it needs one of an explicit context.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ [bench.authorHeader[0]]: bench.authorHeader[1] });
  const saves: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/h5p/content')) saves.push(r.url());
  });
  const response = await page.goto(`${bench.base}/h5p/edit/${bench.contentId}`);
  await page
    .frameLocator('iframe.h5p-editor-iframe')
    .locator('.h5peditor-form')
    .first()
    .waitFor({ timeout: 30_000 });
  const frame = page.mainFrame();
  if (!(await loadProbeScript(frame))) throw new Error('the probe script did not run');
  const csp = (await response?.headerValue('content-security-policy')) ?? '';
  return { page, frame, csp, saves, close: () => context.close() };
}

/**
 * Adds an inline `<script>` the way any page script would; records whether it ran and what the policy reported.
 * @param frame - The editor page's document.
 * @returns Whether the script ran, and the violated directive of each `securitypolicyviolation` event.
 */
export const addInlineScript = (frame: Frame): Promise<{ ran: boolean; refused: string[] }> =>
  frame.evaluate(async () => {
    const refused: string[] = [];
    document.addEventListener('securitypolicyviolation', (e) => refused.push(e.violatedDirective));
    const reported = new Promise((go) => document.addEventListener('securitypolicyviolation', go));
    const script = document.createElement('script');
    script.textContent = 'window.hvliProbeInlineRan = true;';
    document.head.append(script);
    // WHY: the report is a queued event: wait for it (10 s at most), then 100 ms, an absence margin, for others.
    const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms));
    await Promise.race([reported, sleep(10_000)]).then(() => sleep(100));
    return { ran: 'hvliProbeInlineRan' in window, refused };
  });

/**
 * `expect.poll` with room for a busy runner, where reading a queued dialog event or H5P's growing form can outlast
 * Vitest's default of 1 s.
 * @param read - Reads the value, e.g. the probe's log.
 * @returns The assertion to await, e.g. `await eventually(() => probeLog(frame)).toEqual(…)`.
 */
export const eventually = <T>(read: () => Promise<T>) => expect.poll(read, { timeout: 20_000 });

/**
 * Arms the probe on the editor's save button and presses Enter on it, as a keyboard user saves.
 * @param probe - The editor page.
 * @param options - Probe options.
 */
export async function openByKeyboard(probe: ProbePage, options: ProbeOptions = {}): Promise<void> {
  await armProbe(probe.frame, options);
  await probe.page.focus('#hvl-editor-save');
  await probe.page.keyboard.press('Enter');
  await probe.page.locator('dialog[open]').waitFor();
}

/**
 * Arms the probe on the editor's save button and clicks it, as a mouse user saves.
 * @param probe - The editor page.
 * @param options - Probe options.
 * @throws Error when five clicks did not open the dialog.
 */
export async function openByMouse(probe: ProbePage, options: ProbeOptions = {}): Promise<void> {
  await armProbe(probe.frame, options);
  await clickUntilOpen(probe.frame);
}

/** Waits until a box has kept its place and size for 200 ms, for up to 10 s. */
const standingStill = async (target: Locator): Promise<void> => {
  let last = '';
  for (let tries = 0; tries < 50; tries++) {
    const box = JSON.stringify(await target.boundingBox());
    if (box === last) return;
    last = box;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

/**
 * Clicks «Lagre» in an editor page's document until the armed probe has opened its dialog.
 * @param frame - The editor page's own document (the top frame in the portal, Canvas's tool frame there).
 * @throws Error when five clicks did not open the dialog.
 */
export async function clickUntilOpen(frame: Frame): Promise<void> {
  // WHY: H5P resizes its editor iframe as the form fills in (h5peditor-editor.js `resize`), moving «Lagre» by a
  // screen or more for a while after the form appears, so each click waits until the button stands still; one that
  // still misses (the iframe grew between Playwright's hit check and its click) leaves the probe armed: try again.
  for (let attempt = 0; (await frame.locator('dialog[open]').count()) === 0; attempt++) {
    if (attempt === 5) throw new Error('five clicks on «Lagre» did not open the dialog');
    await standingStill(frame.locator('#hvl-editor-save'));
    await frame.click('#hvl-editor-save');
  }
}

/**
 * Arms the probe on the save button of an editor page's document: its next click opens the dialog instead of saving.
 * @param frame - The editor page's own document.
 * @param options - Probe options.
 */
export async function armProbe(frame: Frame, options: ProbeOptions): Promise<void> {
  await frame.evaluate(
    ([texts, settings]) => {
      const button = document.getElementById('hvl-editor-save');
      const choice = (window as unknown as { hvliProbeSaveChoice: { armOn: (...a: unknown[]) => void } })
        .hvliProbeSaveChoice;
      choice.armOn(button, texts, settings);
    },
    [SAVE_CHOICE_TEXTS, options] as const,
  );
}
