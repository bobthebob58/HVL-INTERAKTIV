/**
 * editorFrameHost — opens the real H5P editor page inside a same-origin parent page, as the web app frames it, and
 * sends it "Gå til feltet" messages, for the browser tests of finding a field.
 *
 * Why: the editor page takes `hvli:go-to-field` only from the window that frames it on our own origin, so these
 *      tests need a parent page; the go-to-field tests share how they open the editor, post a path and read where
 *      focus landed inside H5P's editor frame.
 * Spec: PROD-003, UD-006
 * Invariants:
 *   - The parent page (`/frame-host`) is empty and on the testbed's own origin; the editor is framed at a fixed size.
 *   - `focusedField` names only H5P's `field-name-` class of the focused control's field and whether the control is
 *     CKEditor's editable; it reads no content.
 * Collaborators: ../../support/httpTestbed.ts, ../../../src/h5p/render/client/editorPage.js.
 * Tests: used by ../editorGoToField.browser.int.test.ts.
 */
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { Frame, Page } from 'playwright-core';
import type { TestActor } from '../../support/httpTestbed.js';

/** Where the empty parent page is served. */
export const FRAME_HOST_PATH = '/frame-host';

/**
 * Serves the empty same-origin parent page that stands in for the web app.
 * @param app - The testbed's app.
 */
export function serveFrameHost(app: Express): void {
  app.get(FRAME_HOST_PATH, (_req, res) => void res.type('html').send('<!doctype html><title>host</title>'));
}

/** Where focus is in H5P's editor frame: the field's `field-name-` class, the tag, and if it is CKEditor's editable. */
export interface FocusedField {
  readonly field: string | null;
  readonly tag: string | null;
  readonly editable: boolean;
}

/**
 * Reads where focus is in H5P's editor frame.
 * @param editor - H5P's editor frame (inside the editor page).
 * @returns The focused control's field class, tag and whether it is CKEditor's editable.
 */
export function focusedField(editor: Frame): Promise<FocusedField> {
  return editor.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const field = active?.closest('.field');
    return {
      field: [...(field?.classList ?? [])].find((name) => name.startsWith('field-name-')) ?? null,
      tag: active?.tagName ?? null,
      editable: active?.classList.contains('ck-editor__editable') ?? false,
    };
  });
}

/**
 * Opens the editor for an activity inside the parent page.
 * @param page - A new page whose requests carry the author's test header.
 * @param base - The testbed server's origin.
 * @param author - The author whose test header authenticates the requests.
 * @param contentId - The activity to edit.
 * @returns The editor page's frame and H5P's editor frame inside it.
 * @throws Error when the frames do not appear.
 */
export async function openFramedEditor(
  page: Page,
  base: string,
  author: TestActor,
  contentId: string,
): Promise<{ editorPage: Frame; editor: Frame }> {
  await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
  await page.goto(`${base}${FRAME_HOST_PATH}`);
  await page.evaluate((src) => {
    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = 'editor';
    frame.style.cssText = 'width:1000px;height:800px';
    document.body.append(frame);
  }, `/h5p/edit/${contentId}`);
  const outer = page.frameLocator('iframe[title="editor"]');
  await outer.frameLocator('iframe.h5p-editor-iframe').locator('.h5peditor-form').first().waitFor();
  const editorPage = page.frames().find((frame) => frame.url().includes('/h5p/edit/'));
  const editor = page.frames().find((frame) => frame.parentFrame() === editorPage);
  if (!editorPage || !editor) throw new Error('editor frames not found');
  return { editorPage, editor };
}

/**
 * Posts `hvli:go-to-field` from the parent page to the framed editor page, as the web app's Check panel does.
 * @param page - The parent page.
 * @param path - The finding's path.
 */
export async function postGoToField(page: Page, path: string): Promise<void> {
  await page.evaluate((findingPath) => {
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    frame.contentWindow?.postMessage({ type: 'hvli:go-to-field', path: findingPath }, location.origin);
  }, path);
}

/**
 * Gives an imported InteractiveVideo a second interaction (a copy of its first) through the content API.
 * @param base - The testbed server's origin.
 * @param author - The activity's author.
 * @param contentId - The InteractiveVideo activity.
 * @throws Error when the content API refuses the save.
 */
export async function addSecondInteraction(
  base: string,
  author: TestActor,
  contentId: string,
): Promise<void> {
  const headers = { [author.header[0]]: author.header[1], 'content-type': 'application/json' };
  const stored = (await (await fetch(`${base}/h5p/params/${contentId}`, { headers })).json()) as {
    library: string;
    params: { params: { interactiveVideo: { assets: { interactions: { action: object }[] } } } };
  };
  const interactions = stored.params.params.interactiveVideo.assets.interactions;
  const [first] = interactions;
  if (!first) throw new Error('the InteractiveVideo has no interaction to copy');
  interactions.push({ ...first, action: { ...first.action, subContentId: randomUUID() } });
  const body = JSON.stringify({ library: stored.library, params: stored.params });
  const saved = await fetch(`${base}/h5p/content/${contentId}`, { method: 'PUT', headers, body });
  if (!saved.ok) throw new Error(`saving the second interaction failed: ${saved.status}`);
}
