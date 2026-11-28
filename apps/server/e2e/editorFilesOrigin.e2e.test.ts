/**
 * End-to-end test of where the editor asks for uploaded files, in Chromium (SEC-004, D-153). The signed-in Feide
 * author opens the example of each of the ten content types on **Rediger**; then copies the Image Hotspots example
 * with H5P's own copy button and pastes it over a draft of their own and into a new activity. Every request for an
 * uploaded file goes to the files origin and none to the app's own, whose two cookie routes for files are gone. The
 * pasting activity's grant does not open the copied activity's picture; after «Lagre» the picture is the draft's
 * own file, served from the files origin. The whole server with the built web app and the real content types
 * (../test/support/realWebApp.ts); a failed step names itself (../test/support/flowRecorder.ts).
 *
 * Spec: SEC-004, H5P-007
 */
import { chromium, type Browser, type BrowserContext, type Frame, type Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { editorFrame } from '../a11y/support/pages.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { pressEditorSave } from './support/editorSave.js';
import { distinctUserFileRequests, recordUserFileRequests } from './support/userFileRequests.js';

/** H5P's own copy and paste buttons above the form, the hub's paste button, and «Paste & Replace»'s confirmation. */
const COPY = '.h5peditor-copy-button:not(.disabled)';
const PASTE = '.h5peditor-paste-button:not(.disabled)';
const PASTE_NEW = '#h5peditor-hub-paste-button:not(.disabled)';
const CONFIRM = '.h5p-confirmation-dialog-popup button.h5p-core-button';
/** The picture field's «Rediger bilete», which the form shows once a pasted Image Hotspots is built. */
const PICTURE_FIELD = '.h5p-editing-image-button';

/** The content types whose example shows an uploaded file in the editor as soon as it opens. */
const WITH_FILES = [
  'BranchingScenario',
  'Column',
  'CoursePresentation',
  'ImageHotspots',
  'InteractiveBook',
  'InteractiveVideo',
];

const visible = (frame: Frame, selector: string) => frame.locator(selector).filter({ visible: true }).first();

describeWithRealWebApp('[SEC-004] where the editor asks for uploaded files', () => {
  let browser: Browser;
  let app: RealWebApp;
  let context: BrowserContext;
  beforeAll(async () => {
    browser = await chromium.launch();
    app = await openRealWebApp(browser);
    context = await browser.newContext({
      storageState: app.authorStorage,
      viewport: { width: 1280, height: 900 },
    });
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  /** Opens an editor page and waits until H5P has asked for what its form shows. */
  const openEditor = async (page: Page, path: string): Promise<Frame> => {
    await page.goto(`${app.base}${path}`);
    const editor = await editorFrame(page);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    return editor;
  };

  it('[SEC-004] each of the ten editors asks for its example’s files on the files origin only', async () => {
    // Arrange
    const asked = new Map<string, string[]>();
    // Act: each editor in a page of its own, so no late answer is counted for the next type
    for (const [type, id] of app.ids) {
      const page = await context.newPage();
      const files = recordUserFileRequests(page);
      await openEditor(page, `/aktivitet/${id}?fane=edit`);
      // WHY: a form shows a picture's place before the picture's bytes are answered; wait where an answer is due.
      const due = WITH_FILES.includes(type.slice(4)) ? 1 : 0;
      await expect.poll(() => files.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(due);
      asked.set(type, distinctUserFileRequests(files));
      await page.close();
    }
    // Assert: saved files only, each answered by the files origin (206 is a part of a video)
    const fromFilesOrigin = [200, 206].map((status) => `${app.filesBase} editor-files ${status}`);
    expect(asked.size).toBe(10);
    expect(asked.get('H5P.ImageHotspots')).toEqual([fromFilesOrigin[0]]);
    // WHY: the six examples whose form shows a picture or a video when it opens; the other four hold text alone.
    const withFiles = [...asked].filter(([, lines]) => lines.length > 0).map(([type]) => type.slice(4));
    expect(withFiles.sort()).toEqual(WITH_FILES);
    for (const [type, lines] of asked) {
      for (const line of lines) expect(fromFilesOrigin, `${type}: ${line}`).toContain(line);
    }
  }, 300_000);

  it('[SEC-004] a pasted piece asks for no file on the app origin, and saving makes its picture the activity’s own', async () => {
    // Arrange
    const source = app.ids.get('H5P.ImageHotspots') ?? '';
    const page = await context.newPage();
    const files = recordUserFileRequests(page);
    const flow = await recordFlow(page, app.base);
    const since = (mark: number) => distinctUserFileRequests(files.slice(mark));
    const seen = await flow.run(async () => {
      // Act: copy the example, and paste it over the author's draft
      flow.step = 'copy';
      await visible(await openEditor(page, `/aktivitet/${source}?fane=edit`), COPY).click();
      flow.step = 'paste over the draft';
      let editor = await openEditor(page, `/aktivitet/${app.draftId}?fane=edit`);
      let mark = files.length;
      await visible(editor, PASTE).click();
      await visible(editor, CONFIRM).click();
      await visible(editor, PICTURE_FIELD).waitFor({ timeout: 30_000 });
      await expect.poll(() => files.length, { timeout: 15_000 }).toBeGreaterThan(mark);
      const pasted = since(mark);
      // Act: save, and open the draft again
      flow.step = 'save';
      const outer = page.frames().find((frame) => frame.url().includes('/h5p/edit/')) as Frame;
      const saved = await pressEditorSave(page, outer, app.draftId);
      flow.step = 'open the saved draft';
      mark = files.length;
      await openEditor(page, `/aktivitet/${app.draftId}?fane=edit`);
      // WHY: the form is drawn before the picture's bytes are answered; wait for the files origin's answer.
      await expect
        .poll(() => since(mark), { timeout: 20_000 })
        .toContain(`${app.filesBase} editor-files 200`);
      const reopened = since(mark);
      // Act: paste the same piece into a new activity
      flow.step = 'paste into a new activity';
      editor = await openEditor(page, '/aktivitet/ny');
      mark = files.length;
      await visible(editor, PASTE_NEW).click();
      await visible(editor, PICTURE_FIELD).waitFor({ timeout: 30_000 });
      await expect.poll(() => files.length, { timeout: 15_000 }).toBeGreaterThan(mark);
      return { pasted, saved: saved.status(), reopened, intoNew: since(mark) };
    });
    const stored = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: app.draftId } });
    const picture = (stored.params as { image?: { path?: string } }).image?.path ?? '';
    // Assert: nothing was asked of the app origin, and of the files origin only the two editor paths
    const everywhere = distinctUserFileRequests(files).map((line) => line.split(' ').slice(0, 2).join(' '));
    expect([...new Set(everywhere)]).toEqual([`${app.filesBase} editor-files`, `${app.filesBase} uploads`]);
    // SECURITY: the draft's grant, and the author's upload grant, do not open the copied activity's picture
    for (const line of [...seen.pasted, ...seen.intoNew]) expect(line).not.toMatch(/ 2\d\d$/);
    expect(seen.pasted.every((line) => line.startsWith(`${app.filesBase} editor-files `))).toBe(true);
    expect(seen.intoNew.every((line) => line.startsWith(`${app.filesBase} uploads `))).toBe(true);
    // Assert: the save copied the picture into the draft, which now shows it from the files origin
    expect(seen.saved).toBe(200);
    expect([stored.mainLibrary, picture]).toEqual([
      'H5P.ImageHotspots',
      expect.stringMatching(/^images\/[\w-]+\.png$/),
    ]);
    expect(seen.reopened).toEqual([`${app.filesBase} editor-files 200`]);
    expect(flow.problems).toEqual([]);
    await page.close();
  }, 300_000);
});
