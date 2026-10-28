/**
 * placeholderMarkerCkeditor — starts CKEditor 5 in a rich-text field of H5P's real editor for probe P6, waits until
 * it runs there, and selects text in it by keyboard, key by key, as an author does.
 *
 * Why: a guidance marker `⟦…⟧` (D-086) is only safe if it survives CKEditor parsing and re-serialising a field
 *      and an author editing part of it. CKEditor starts asynchronously and moves its selection after the
 *      browser's, so each step waits until CKEditor shows the state the next step needs; a fixed pause is too
 *      short on a busy CI runner.
 * Spec: PROD-001
 * Invariants:
 *   - A field counts as loaded only when H5P's current CKEditor instance runs on that field's element and has focus.
 *   - A key is pressed only once CKEditor's model selection stands where the previous key moved it.
 * Collaborators: ./placeholderMarkerEditor.ts (loads every field), ./placeholderMarker.browser.int.test.ts.
 * Tests: apps/server/test/learningDesign/patterns/placeholderMarker.browser.int.test.ts
 */
import type { Locator, Page } from 'playwright-core';
import { expect } from 'vitest';

/** The parts of H5P's current CKEditor 5 instance the probe reads, in the editor frame. */
type Ckeditor = {
  sourceElement?: Element;
  editing: { view: { document: { isFocused: boolean } } };
  model: { document: { selection: { anchor: { path: number[] } | null; focus: { path: number[] } | null } } };
};
type EditorWindow = { H5PEditor: { Html?: { current?: { ckeditor?: Ckeditor } } } };

/** A key and where it leaves the selection's anchor and focus, as offsets in the field's first paragraph. */
type Step = readonly [key: string, anchor: number, focus: number];

/** Whether H5P's current CKEditor 5 instance runs on this field and has the focus. */
const runsCkeditor = (field: Locator): Promise<boolean> =>
  field.evaluate((element) => {
    const ckeditor = (window as unknown as EditorWindow).H5PEditor.Html?.current?.ckeditor;
    return ckeditor?.sourceElement === element && ckeditor.editing.view.document.isFocused;
  });

/** The model selection of the CKEditor in a field, as [anchor path, focus path]; null when it runs elsewhere. */
const modelSelection = (field: Locator): Promise<number[][] | null> =>
  field.evaluate((element) => {
    const ckeditor = (window as unknown as EditorWindow).H5PEditor.Html?.current?.ckeditor;
    const { anchor, focus } = ckeditor?.model.document.selection ?? {};
    return ckeditor?.sourceElement === element && anchor && focus ? [anchor.path, focus.path] : null;
  });

/**
 * Waits until CKEditor 5 runs on a rich-text field and has the focus, whether H5P or a click started it.
 * @param field - The field's `.ckeditor` element.
 * @throws When CKEditor has not started there within 30 s.
 */
export const ckeditorRuns = (field: Locator): Promise<void> =>
  expect
    .poll(() => runsCkeditor(field), { timeout: 30_000, message: 'CKEditor did not start on the field' })
    .toBe(true);

/**
 * Focuses a rich-text field (unless H5P already did) and waits until CKEditor 5 runs on it and has the focus.
 * @param field - The field's `.ckeditor` element.
 */
export async function loadCkeditor(field: Locator): Promise<void> {
  if (!(await runsCkeditor(field))) await field.click();
  // WHY: H5P creates CKEditor asynchronously and focuses its editable afterwards; keys sent earlier go elsewhere.
  await ckeditorRuns(field);
}

/**
 * Loads CKEditor in a rich-text field and selects `count` characters from position `from`, by keyboard, within the
 * field's first paragraph.
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
  const steps: Step[] = [
    ['Control+Home', 0, 0],
    ...Array.from({ length: from }, (_, i): Step => ['ArrowRight', i + 1, i + 1]),
    ...Array.from({ length: count }, (_, i): Step => ['Shift+ArrowRight', from, from + i + 1]),
  ];
  for (const [key, anchor, focus] of steps) {
    await page.keyboard.press(key);
    // WHY: CKEditor renders its model selection back into the page; a key pressed before the model has taken the
    // previous one is undone, so each key waits until the model selection stands where that key moves it.
    const moved = { timeout: 10_000, message: `CKEditor's selection did not follow ${key}` };
    const expected = [
      [0, anchor],
      [0, focus],
    ];
    await expect.poll(() => modelSelection(field), moved).toEqual(expected);
  }
  return field.evaluate(() => window.getSelection()?.toString() ?? '');
}
