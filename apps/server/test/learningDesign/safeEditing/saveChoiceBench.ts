/**
 * saveChoiceBench — drives the real editor page in Chromium for the save choice's round trip (PROD-013): frames it
 * in a page of ours (as the activity page's Rediger tab does) or of the mock Canvas (`/lti/edit`), makes a
 * structural edit in H5P's own form, presses «Lagre», and records the requests, the framing page's messages and
 * where focus was each time the status region changed.
 *
 * Why: the dialog, the 409 and the retry or copy only prove PROD-013 together, on a real type, with the real
 *      editor building the parameters and the server's learner-state check answering (D-093). The framing page is
 *      ours so that it can record `hvli:*` messages as the web app's activity page would receive them.
 * Spec: PROD-013, UD-006
 * Invariants:
 *   - The edit is the author's own: H5P's list "add" button of MultiChoice's options, which changes the option count
 *     (structural, D-093) and nothing else.
 *   - A click on «Lagre» counts only once its save request is sent; a miss (H5P still resizing its iframe) is
 *     retried, a sent one never.
 *   - Every page has its own browser context, closed by `close`; the bench sends no request of its own.
 * Collaborators: ./safeEditingBench.ts (the app and the state rows), ../../support/runFeideAuthor.ts (the sign-in),
 *   ./editorSaveDialogBench.ts (`eventually`), ../../../src/h5p/render/client/editorSaveChoice.js.
 * Tests: ./saveChoiceRoundTrip.browser.int.test.ts, ./saveChoiceKeyboard.browser.int.test.ts,
 *   ./saveChoiceCanvas.browser.int.test.ts, apps/server/a11y/axeSaveChoice.a11y.test.ts (`addOption`),
 *   apps/server/e2e/safeEditReset.e2e.test.ts (`addOption`)
 */
import type { Browser, Frame, Page } from 'playwright-core';
import type { BrowserStorage } from '../../support/runFeideAuthor.js';

/** A request the editor page sent to `/h5p/content…`, with what the server answered. */
export interface SentRequest {
  readonly method: string;
  readonly path: string;
  readonly body: Record<string, unknown>;
  readonly status: number;
}

/** The editor page in its frame, and what the bench recorded. */
export interface FramedEditor {
  readonly page: Page;
  /** The editor page's own document (our tool frame). */
  readonly tool: Frame;
  /** H5P's editor iframe inside it. */
  readonly form: Frame;
  /** Save and copy requests, in order, once answered. */
  readonly requests: SentRequest[];
  /** The `hvli:*` messages the framing page received from the tool frame. */
  messages(): Promise<unknown[]>;
  /** Each status text the editor page showed, with the id of the element that had focus at that moment. */
  statusLog(): Promise<{ text: string; focus: string }[]>;
  close(): Promise<void>;
}

/** Where the editor page is framed: a page of ours, or the mock Canvas's (another origin). */
export interface FrameHost {
  /** The framing page's URL; a path of the tool is answered by the bench with an empty page. */
  readonly url: string;
  /** The editor page's URL, e.g. `/h5p/edit/<id>` or `/lti/edit?ltik=…`, absolute. */
  readonly editorUrl: string;
  /** The portal author's signed-in browser storage (`signInRunAuthor`), for a portal editor page. */
  readonly storageState?: BrowserStorage;
}

const isSave = (path: string) => /^\/h5p\/content(\/[^/]+(\/copy)?)?$/.test(path);

/** Records the editor's save and copy requests with their answers. */
const recordRequests = (page: Page, requests: SentRequest[]): void => {
  page.on('response', (response) => {
    const request = response.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' || !isSave(path)) return;
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
    requests.push({ method: request.method(), path, body, status: response.status() });
  });
};

/**
 * Opens the framing page, frames the editor page in it, and waits until H5P has built its form.
 * @param browser - The running Chromium.
 * @param host - Where the editor is framed and how it is signed in.
 * @returns The framed editor; call `close()` at the end of the test.
 */
export async function openFramedEditor(browser: Browser, host: FrameHost): Promise<FramedEditor> {
  const context = await browser.newContext(host.storageState ? { storageState: host.storageState } : {});
  const tool = new URL(host.editorUrl).origin;
  if (new URL(host.url).origin === tool) {
    await context.route(host.url, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  }
  const page = await context.newPage();
  const requests: SentRequest[] = [];
  recordRequests(page, requests);
  await page.goto(host.url);
  await page.evaluate((src) => {
    const recorded: unknown[] = [];
    Object.assign(window, { hvliRecorded: recorded });
    const frame = Object.assign(document.createElement('iframe'), {
      id: 'tool_content',
      name: 'tool_content',
    });
    Object.assign(frame, { src, title: 'HVL Interaktiv' });
    frame.style.cssText = 'width: 900px; height: 600px';
    window.addEventListener('message', (event) => {
      if (event.source === frame.contentWindow) recorded.push(event.data);
    });
    document.body.append(frame);
  }, host.editorUrl);
  const formLocator = page.frameLocator('#tool_content').frameLocator('iframe.h5p-editor-iframe');
  await formLocator.locator('.field-name-answer').first().waitFor({ timeout: 60_000 });
  const toolFrame = page.frame({ name: 'tool_content' });
  const form = toolFrame?.childFrames()[0];
  if (!toolFrame || !form) throw new Error('the editor page did not load in its frame');
  await watchStatus(toolFrame);
  return {
    page,
    tool: toolFrame,
    form,
    requests,
    messages: () => page.evaluate(() => [...(window as unknown as { hvliRecorded: unknown[] }).hvliRecorded]),
    statusLog: () =>
      toolFrame.evaluate(() => [...(window as unknown as { hvliStatusLog: unknown[] }).hvliStatusLog]),
    close: () => context.close(),
  } as FramedEditor;
}

/** Records each text of the editor page's status region with the id of the focused element at that moment. */
const watchStatus = (tool: Frame): Promise<void> =>
  tool.evaluate(() => {
    const status = document.getElementById('hvl-editor-status') as HTMLElement;
    const log: { text: string; focus: string }[] = [];
    Object.assign(window, { hvliStatusLog: log });
    new MutationObserver(() => {
      const active = document.activeElement;
      log.push({ text: status.textContent ?? '', focus: active?.id || active?.tagName || 'none' });
    }).observe(status, { childList: true, characterData: true, subtree: true });
  });

/**
 * Adds an option to the MultiChoice in H5P's form, as an author does with the list's add button.
 * @param form - H5P's editor iframe.
 * @returns How many options the form has afterwards.
 */
export async function addOption(form: Frame): Promise<number> {
  // WHY: H5P gives a list's wrapper no `field-name-` class; its label names the list's element (`field-answers-N`).
  const list = form.locator('.field.list').filter({ has: form.locator('label[for^="field-answers-"]') });
  const options = list.first().locator('fieldset.field-name-answer');
  const before = await options.count();
  await list.first().locator('.h5peditor-button-textual:not(.h5peditor-button-collapse)').last().click();
  await options.nth(before).waitFor();
  return options.count();
}

/**
 * Presses «Lagre» (by mouse, or Enter by keyboard) until its save request is sent, then waits for the answer.
 * @param editor - The framed editor.
 * @param by - `mouse` or `keyboard`.
 * @throws Error when five attempts sent nothing.
 */
export async function pressSave(editor: FramedEditor, by: 'mouse' | 'keyboard' = 'mouse'): Promise<void> {
  const sent = editor.requests.length;
  const button = editor.tool.locator('#hvl-editor-save');
  for (let attempt = 0; attempt < 5; attempt++) {
    const answered = editor.page
      .waitForResponse((r) => isSave(new URL(r.url()).pathname) && r.request().method() !== 'GET', {
        timeout: 10_000,
      })
      .catch(() => undefined);
    // WHY: H5P resizes its editor iframe while the form fills in, moving «Lagre»; a missed click sends nothing.
    if (by === 'keyboard') {
      await button.focus();
      await editor.page.keyboard.press('Enter');
    } else {
      await button.click({ timeout: 5_000 }).catch(() => undefined);
    }
    if (await answered) break;
  }
  // WHY: the response handler that records the request runs in the same tick as waitForResponse's.
  for (let tries = 0; editor.requests.length === sent && tries < 50; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (editor.requests.length === sent) throw new Error('«Lagre» sent no save request');
}

/** The id of the focused element in the editor page's document. */
export const focusedIn = (frame: Frame): Promise<string> =>
  frame.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || 'none');
