/**
 * End-to-end test of the editor's picture tool in Chromium (H5P-001, SEC-004, D-153): the signed-in Feide author
 * opens a saved Image Hotspots activity on **Rediger**, presses «Rediger bilete», turns the picture, crops it and
 * saves. The tool opens (its script is loaded as a file, since the page policy refuses H5P's own way of loading it),
 * draws the saved picture into its canvas and exports it, and the edited picture is uploaded and shown. Both the
 * saved picture and the fresh upload come from the files origin, and no request for an uploaded file goes to the
 * app's own. The whole server with the built web app and the real content types (../test/support/realWebApp.ts); a
 * failed step names itself (../test/support/flowRecorder.ts).
 *
 * Spec: H5P-001, SEC-004
 */
import { chromium, type Browser, type Frame, type Locator, type Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { editorFrame } from '../a11y/support/pages.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { distinctUserFileRequests, recordUserFileRequests } from './support/userFileRequests.js';

/** The picture tool's own buttons, in the order H5P's cropper draws them: turn left, turn right, crop. */
const TOOL_BUTTONS = '.cropper-image-button';
const [TURN_RIGHT, CROP] = [1, 2];
/** The two controls the tool shows while a crop is being drawn: confirm first, then cancel. */
const CROP_DECISION = '.cropper-button:not(.cropper-image-button)';

/** A window tall enough that the editor frame (85vh) shows the tool's controls where the tool opens. */
const VIEWPORT = { width: 1280, height: 900 };

/** Presses a control of the tool with the pointer. */
const press = (control: Locator): Promise<void> => control.click({ timeout: 10_000 });

/** The frame of the page that holds the open picture tool. */
async function pictureTool(page: Page): Promise<Frame> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    for (const frame of page.frames()) {
      if ((await frame.locator(TOOL_BUTTONS).count()) >= 3) return frame;
    }
    await page.waitForTimeout(250);
  }
  throw new Error('the picture tool did not open');
}

describeWithRealWebApp('[H5P-001] the picture tool of the editor', () => {
  let browser: Browser;
  let app: RealWebApp;
  beforeAll(async () => {
    browser = await chromium.launch();
    app = await openRealWebApp(browser);
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[H5P-001][SEC-004] «Rediger bilete» turns, crops and saves a saved picture', async () => {
    // Arrange
    const id = app.ids.get('H5P.ImageHotspots') ?? '';
    const context = await browser.newContext({ storageState: app.authorStorage, viewport: VIEWPORT });
    const page = await context.newPage();
    const flow = await recordFlow(page, app.base, {
      // WHY: at its first opening the tool still asks jQuery to run its script as inline script, which the page
      // policy refuses (D-070); the script is already loaded as a file of the editor frame (src/h5p/h5pAssets.ts).
      ignoreConsole: (m) =>
        m.text().includes('inline script') && m.location().url.includes('/core/js/jquery.js'),
    });
    const files = recordUserFileRequests(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message.split('\n')[0] ?? ''));
    const uploaded = () =>
      page.waitForResponse((r) => /action=files/.test(r.url()) && r.request().method() === 'POST', {
        timeout: 20_000,
      });
    const seen = await flow.run(async () => {
      // Act: open the tool on the activity's picture
      flow.step = 'open the editor';
      await page.goto(`${app.base}/aktivitet/${id}?fane=edit`);
      const editor = await editorFrame(page);
      flow.step = 'open the picture tool';
      await editor.locator('.h5p-editing-image-button').first().click();
      const tool = await pictureTool(page);
      // Act: turn the picture, crop it, and save
      flow.step = 'turn';
      await press(tool.locator(TOOL_BUTTONS).nth(TURN_RIGHT));
      flow.step = 'crop';
      await press(tool.locator(TOOL_BUTTONS).nth(CROP));
      await press(tool.locator(CROP_DECISION).filter({ visible: true }).first());
      flow.step = 'save';
      const upload = uploaded();
      await press(tool.locator('.h5p-editing-image-save-button'));
      const answer = await upload;
      const file = ((await answer.json()) as { path?: string }).path ?? '';
      flow.step = 'the edited picture';
      // WHY: the field showed the saved picture before; wait until it shows the one just uploaded.
      const shown = editor.locator('.h5p-editor-image img, .file img, img.thumbnail').first();
      const src = async () => (await shown.getAttribute('src')) ?? '';
      await expect.poll(src, { timeout: 15_000 }).toContain(file.replace('#tmp', ''));
      return { status: answer.status(), file, shown: await src() };
    });
    // Assert: the canvas was exported and the new picture is the one shown
    expect(errors).toEqual([]);
    expect(seen.status).toBe(200);
    expect(seen.file).toMatch(/^images\/.+#tmp$/);
    expect(seen.shown).toContain(seen.file.replace('#tmp', ''));
    // Assert: the saved picture and the upload came from the files origin, and nothing from the app's own
    expect(seen.shown.startsWith(`${app.filesBase}/h5p/uploads/`)).toBe(true);
    expect(distinctUserFileRequests(files)).toEqual([
      `${app.filesBase} editor-files 200`,
      `${app.filesBase} uploads 200`,
    ]);
    expect(flow.problems).toEqual([]);
    await context.close();
  }, 300_000);
});
