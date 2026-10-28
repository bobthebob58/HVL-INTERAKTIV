/**
 * placeholderMarkerEditor — drives H5P's real editor in Chromium for probe P6: opens an activity, loads CKEditor in
 * every rich-text field the author can reach (CoursePresentation's slide text through its element form), selects text
 * by keyboard for a partial edit, and saves through the editor page, returning what the editor sent.
 *
 * Why: a guidance marker `⟦…⟧` (D-086) is only safe if it survives what an author's editor does to the text:
 *      CKEditor 5 parses and re-serialises a rich-text field when it loads and when it is destroyed, and H5P's text
 *      widgets re-escape a value the author changes. An unchanged save without loading CKEditor would not show that.
 * Spec: PROD-001
 * Invariants:
 *   - A field counts as loaded only when H5P's current CKEditor instance runs on that field's element and has focus.
 *   - Every console error, page error and failed request is reported; each page is closed by the caller.
 * Collaborators: ./placeholderMarker.browser.int.test.ts, ../../../src/h5p/render/client/editorPage.js,
 *   ../../support/httpTestbed.ts (actor headers).
 * Tests: apps/server/test/learningDesign/patterns/placeholderMarker.browser.int.test.ts
 */
import type { Browser, Frame, Locator, Page } from 'playwright-core';
import { t } from '../../../src/i18n/translate.js';
import type { TestActor } from '../../support/httpTestbed.js';

/** An open editor page, H5P's editor frame in it, and what the browser reported. */
export interface OpenEditor {
  readonly page: Page;
  readonly editor: Frame;
  readonly problems: string[];
}

/** One save through the editor page. */
export interface EditorSave {
  readonly status: number;
  /** The parameters and metadata the editor sent. */
  readonly sent: { params: object; metadata: object };
}

/**
 * Opens the editor for an activity as the author and waits until H5P has built its form.
 * @param browser - The running Chromium.
 * @param base - The server's base URL.
 * @param author - The author.
 * @param contentId - The activity.
 * @returns The page, H5P's editor frame and the problem list the page keeps filling.
 */
export async function openEditor(
  browser: Browser,
  base: string,
  author: TestActor,
  contentId: string,
): Promise<OpenEditor> {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
  const problems: string[] = [];
  page.on('console', (m) => void (m.type() === 'error' && problems.push(`console: ${m.text()}`)));
  page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
  page.on('response', (r) => void (r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`)));
  await page.goto(`${base}/h5p/edit/${contentId}`);
  const frame = await page.waitForSelector('iframe.h5p-editor-iframe');
  const editor = await frame.contentFrame();
  if (!editor) throw new Error('H5P editor frame not found');
  await editor.locator('.h5peditor-form').first().waitFor({ timeout: 30_000 });
  // WHY: content-type editors (CoursePresentation) finish building after the form appears.
  await page.waitForTimeout(2_000);
  return { page, editor, problems };
}

/** Whether H5P's current CKEditor 5 instance runs on this field and has the focus. */
const runsCkeditor = (field: Locator): Promise<boolean> =>
  field.evaluate((element) => {
    type Editor = { sourceElement?: Element; editing: { view: { document: { isFocused: boolean } } } };
    const ns = (window as unknown as { H5PEditor: { Html?: { current?: { ckeditor?: Editor } } } }).H5PEditor;
    const current = ns.Html?.current?.ckeditor;
    return current?.sourceElement === element && current.editing.view.document.isFocused;
  });

/** Focuses a rich-text field (unless H5P already did) and waits until CKEditor 5 runs on it and has the focus. */
async function loadCkeditor(field: Locator): Promise<void> {
  if (!(await runsCkeditor(field))) await field.click();
  // WHY: H5P creates CKEditor asynchronously and focuses its editable afterwards; keys sent earlier go elsewhere.
  for (let waited = 0; !(await runsCkeditor(field)); waited += 50) {
    if (waited > 20_000) throw new Error('CKEditor did not start on the field');
    await field.page().waitForTimeout(50);
  }
}

/** Opens CoursePresentation's first slide element form (a double click, as an author does), loads CKEditor in its
 * text and closes it; tells whether that text held a marker. */
async function loadSlideText(editor: Frame): Promise<boolean> {
  await editor.locator('.h5p-current .h5p-element').first().dblclick();
  // WHY: the form slides in and then focuses its first field itself, which starts CKEditor there.
  await editor.page().waitForTimeout(1_000);
  const field = editor.locator('.form-manager .field-name-text .ckeditor').first();
  const marked = /[⟦⟧]/.test((await field.textContent()) ?? '');
  await loadCkeditor(field);
  await editor.locator('.form-manager-done:visible').first().click();
  return marked;
}

/** Opens every collapsed group that holds rich text, one at a time, waiting until each has opened. */
async function openGroups(editor: Frame): Promise<void> {
  for (let opened = 0; opened < 30; opened += 1) {
    const title = editor.locator('.field.group:not(.expanded):has(.ckeditor) > .title:visible').first();
    if ((await title.count()) === 0) return;
    const group = await title.evaluateHandle((element) => element.parentElement as HTMLElement);
    await title.click();
    // WHY: a second click before H5P marks the group open would close it again.
    await group.evaluate((element) => {
      const open = (resolve: () => void) =>
        element.classList.contains('expanded') ? resolve() : setTimeout(() => open(resolve), 50);
      return new Promise<void>(open);
    });
  }
}

/**
 * Opens every collapsed group that holds rich text, then loads CKEditor in each visible rich-text field in turn
 * (moving on destroys the previous instance, which writes its text back through H5P's validation); in a
 * CoursePresentation it also opens the first slide element's form, loads CKEditor in its text and presses «Ferdig».
 * @param editor - H5P's editor frame.
 * @returns How many fields that held a marker ran CKEditor.
 */
export async function loadEveryCkeditor(editor: Frame): Promise<number> {
  await openGroups(editor);
  const fields = editor.locator('.ckeditor');
  let marked = 0;
  for (let i = 0; i < (await fields.count()); i += 1) {
    const field = fields.nth(i);
    if (!(await field.isVisible())) continue;
    const text = await field.textContent();
    await loadCkeditor(field);
    if (/[⟦⟧]/.test(text ?? '')) marked += 1;
  }
  if ((await editor.locator('.h5p-current .h5p-element').count()) === 0) return marked;
  return marked + ((await loadSlideText(editor)) ? 1 : 0);
}

/**
 * Loads CKEditor in a rich-text field and selects `count` characters from position `from`, by keyboard.
 * @param page - The editor page (the keyboard follows focus into the frame).
 * @param field - The field's `.ckeditor` element.
 * @param from - Characters to skip from the start.
 * @param count - Characters to select.
 * @returns The selected text, as the browser reports it.
 */
export async function selectInRichText(
  page: Page,
  field: Locator,
  from: number,
  count: number,
): Promise<string> {
  await loadCkeditor(field);
  const keys = ['Control+Home', ...Array<string>(from).fill('ArrowRight')];
  for (const key of [...keys, ...Array<string>(count).fill('Shift+ArrowRight')]) {
    await page.keyboard.press(key);
    // WHY: CKEditor renders its model selection back into the page; a key pressed before that is undone.
    await page.waitForTimeout(100);
  }
  return field.evaluate(() => window.getSelection()?.toString() ?? '');
}

/**
 * Presses the editor page's save button and waits for the answer.
 * @param page - The editor page.
 * @param contentId - The activity.
 * @returns The status and what the editor sent.
 */
export async function saveInEditor(page: Page, contentId: string): Promise<EditorSave> {
  const request = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().endsWith(`/h5p/content/${contentId}`),
  );
  const response = page.waitForResponse((r) => r.url().endsWith(`/h5p/content/${contentId}`));
  await page.click('#hvl-editor-save');
  const body = (await request).postDataJSON() as { params: EditorSave['sent'] };
  const status = (await response).status();
  await page.waitForFunction(
    (saving) => document.querySelector('#hvl-editor-status')?.textContent !== saving,
    t('page.editor.saving', {}, 'nn'),
  );
  return { status, sent: body.params };
}
