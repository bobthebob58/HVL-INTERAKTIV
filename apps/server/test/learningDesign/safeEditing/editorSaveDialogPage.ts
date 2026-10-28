/**
 * editorSaveDialogPage — probe P7's bench: serves the stand-in dialog script and stylesheet the way the editor page's
 * own files are served, loads them into an open editor page, and reads focus, events and the accessibility tree.
 *
 * Why: the production script (`editorSaveChoice.js`, D-093) does not exist yet and the boot route serves only its
 *      allowlist, so the probe adds its files in front of the app with the boot route's headers (portal), or answers
 *      the same-origin request in the browser (Canvas, whose test app listens by itself). Either way the browser
 *      checks them against the page's own policy, unlike DevTools evaluation, which the policy does not govern.
 * Spec: PROD-013, UD-030
 * Invariants:
 *   - Probe files are served only at their two fixed paths, as `text/javascript` / `text/css` with `nosniff` and
 *     `no-cache`, like ../../../src/http/routes/staticRoutes.ts serves the boot scripts.
 *   - The script and the stylesheet are added as `<script src>` / `<link href>` elements, never as inline code.
 * Collaborators: ./editorSaveDialogClient.js, ./editorSaveDialogStyles.css, playwright-core (CDP session).
 * Tests: ./editorSaveDialog.browser.int.test.ts, ./editorSaveDialogCanvas.browser.int.test.ts
 */
import { readFileSync } from 'node:fs';
import express, { type Express } from 'express';
import type { BrowserContext, Frame, Page } from 'playwright-core';

/** Where the probe script is served: beside the boot scripts, as `editorSaveChoice.js` will be. */
export const PROBE_SCRIPT_PATH = '/h5p/boot/editorSaveDialogClient.js';
/** Where the probe stylesheet is served: beside the server pages' stylesheet. */
export const PROBE_STYLES_PATH = '/static/pages/editorSaveDialogStyles.css';

const FILES = new Map([
  [PROBE_SCRIPT_PATH, { file: 'editorSaveDialogClient.js', type: 'text/javascript' }],
  [PROBE_STYLES_PATH, { file: 'editorSaveDialogStyles.css', type: 'text/css' }],
]);
const read = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8');

/** The dialog's texts in Nynorsk; production takes them from the locale files through `#hvl-editor-config`. */
export const SAVE_CHOICE_TEXTS = {
  title: 'Endringa nullstiller det studentane har lagra',
  text: 'Du har endra oppbygginga av aktiviteten. Studentar som har starta, mistar det dei har lagra.',
  choices: [
    { value: 'reset', label: 'Nullstill og lagre' },
    { value: 'copy', label: 'Lagre som ny versjon' },
    { value: 'cancel', label: 'Avbryt' },
  ],
} as const;

/**
 * Puts the probe files in front of an app, with the boot route's headers.
 * @param app - The app under test.
 * @returns An app that serves the two probe paths and passes everything else to `app`.
 */
export function withProbeFiles(app: Express): Express {
  const outer = express();
  for (const [path, { file, type }] of FILES) {
    outer.get(path, (_req, res) => {
      res.set({ 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.type(type).send(read(file));
    });
  }
  return outer.use(app);
}

/**
 * Answers the two probe paths of `origin` in the browser, for an app the test cannot wrap.
 * @param context - The browser context (its routes also reach cross-origin frames).
 * @param origin - The tool's origin, e.g. `http://localhost:1234`.
 */
export async function routeProbeFiles(context: BrowserContext, origin: string): Promise<void> {
  for (const [path, { file, type }] of FILES) {
    await context.route(`${origin}${path}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: type,
        headers: { 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' },
        body: read(file),
      }),
    );
  }
}

/**
 * Adds the probe script as a `<script src>` element and waits until it ran.
 * @param frame - The editor page's frame.
 * @returns Whether the script ran (false when the policy refused it).
 */
export async function loadProbeScript(frame: Frame): Promise<boolean> {
  return frame.evaluate(
    (src) =>
      new Promise<boolean>((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve('hvliProbeSaveChoice' in window);
        script.onerror = () => resolve(false);
        document.head.append(script);
      }),
    PROBE_SCRIPT_PATH,
  );
}

/**
 * Links the probe stylesheet and waits until it applied.
 * @param frame - The editor page's frame.
 * @returns Whether the stylesheet loaded.
 */
export async function linkProbeStyles(frame: Frame): Promise<boolean> {
  return frame.evaluate(
    (href) =>
      new Promise<boolean>((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve(true);
        link.onerror = () => resolve(false);
        document.head.append(link);
      }),
    PROBE_STYLES_PATH,
  );
}

/** Where focus is in a document: the focused element's id (or tag) and whether it shows `:focus-visible`. */
export interface FocusState {
  readonly at: string;
  readonly visible: boolean;
}

/**
 * Reads where focus is in a frame's document.
 * @param frame - The frame to read.
 * @returns The focused element and whether it matches `:focus-visible`.
 */
export async function focusIn(frame: Frame): Promise<FocusState> {
  return frame.evaluate(() => {
    const active = document.activeElement;
    return {
      at: active?.id || active?.tagName || 'none',
      visible: active?.matches(':focus-visible') ?? false,
    };
  });
}

/**
 * Presses a key `times` times and records where focus went after each press.
 * @param page - The page that receives the keys.
 * @param frame - The frame whose focus is read.
 * @param key - E.g. `Tab` or `Shift+Tab`.
 * @param times - How many presses.
 * @returns The focused element after each press.
 */
export async function focusWalk(page: Page, frame: Frame, key: string, times: number): Promise<string[]> {
  const stops: string[] = [];
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    stops.push((await focusIn(frame)).at);
  }
  return stops;
}

/** What the probe script recorded: dialog events and the chosen values. */
export interface ProbeLog {
  readonly log: string[];
  readonly results: string[];
}

/**
 * Reads the probe script's record.
 * @param frame - The editor page's frame.
 * @returns Events (`cancel`, `close:<returnValue>`) and results.
 */
export async function probeLog(frame: Frame): Promise<ProbeLog> {
  return frame.evaluate(() => {
    const probe = (window as unknown as { hvliProbeSaveChoice: ProbeLog }).hvliProbeSaveChoice;
    return { log: [...probe.log], results: [...probe.results] };
  });
}

/**
 * Lists the nodes of a page's accessibility tree (its own document and every child frame's) that assistive
 * technology can reach, as `role:name`, leaving out the document roots and text runs.
 * @param page - The page (Chromium only: a CDP session).
 * @returns The exposed nodes in tree order.
 */
export async function exposedNodes(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const frameIds = [frameTree.frame.id, ...(frameTree.childFrames ?? []).map((child) => child.frame.id)];
  const exposed: string[] = [];
  for (const frameId of frameIds) {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree', { frameId });
    for (const node of nodes) {
      const role = String(node.role?.value ?? '');
      if (node.ignored || ['RootWebArea', 'StaticText', 'InlineTextBox'].includes(role)) continue;
      exposed.push(`${role}:${String(node.name?.value ?? '')}`);
    }
  }
  await cdp.detach();
  return exposed;
}
