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
import type { Browser, Frame, Page } from 'playwright-core';
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
 * Arms the probe on the editor's save button and presses Enter on it, as a keyboard user saves.
 * @param probe - The editor page.
 * @param options - Probe options.
 */
export async function openByKeyboard(probe: ProbePage, options: ProbeOptions = {}): Promise<void> {
  await arm(probe, options);
  await probe.page.focus('#hvl-editor-save');
  await probe.page.keyboard.press('Enter');
  await probe.page.locator('dialog[open]').waitFor();
}

/**
 * Arms the probe on the editor's save button and clicks it, as a mouse user saves.
 * @param probe - The editor page.
 * @param options - Probe options.
 * @throws Error when three clicks did not open the dialog.
 */
export async function openByMouse(probe: ProbePage, options: ProbeOptions = {}): Promise<void> {
  await arm(probe, options);
  // WHY: H5P resizes its editor iframe on every change inside it (h5peditor-editor.js `resize`), which can move
  // «Lagre» between Playwright's hit check and its click; a missed click leaves the probe armed, so it is repeated.
  for (let attempt = 0; attempt < 3; attempt++) {
    await probe.page.click('#hvl-editor-save');
    if ((await probe.page.locator('dialog[open]').count()) > 0) return;
  }
  throw new Error('three clicks on «Lagre» did not open the dialog');
}

async function arm(probe: ProbePage, options: ProbeOptions): Promise<void> {
  await probe.frame.evaluate(
    ([texts, settings]) => {
      const button = document.getElementById('hvl-editor-save');
      const choice = (window as unknown as { hvliProbeSaveChoice: { armOn: (...a: unknown[]) => void } })
        .hvliProbeSaveChoice;
      choice.armOn(button, texts, settings);
    },
    [SAVE_CHOICE_TEXTS, options] as const,
  );
}
