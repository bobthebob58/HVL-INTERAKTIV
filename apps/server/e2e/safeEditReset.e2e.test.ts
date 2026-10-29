/**
 * End-to-end test of safe editing in Chromium (PROD-013, D-093): a student launches a published activity from the
 * mock Canvas and answers, so H5P saves the student's state, and a second launch resumes it; the author then adds an
 * option on the activity's **Rediger** tab in the portal and saves; the save choice opens in the editor while the
 * portal page around it is inert; «Nullstill framgangen og lagre» says it runs, saves, deletes the state and raises
 * the version; the student's next launch starts fresh on the new structure. The whole server with the built web app
 * and the real content types (../test/support/realWebApp.ts); a failed step names itself and what failed before it.
 *
 * Spec: PROD-013, LTI-006, UD-006
 */
import { chromium, type Browser, type Frame } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { saveChoiceMessages } from '../src/learningDesign/safeEditing/saveChoiceMessages.js';
import { addOption } from '../test/learningDesign/safeEditing/saveChoiceBench.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { lostRowsFact } from '../test/support/lostTestRows.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { pressEditorSave } from './support/editorSave.js';
import { editorFrames, frameAt } from './support/portalFrames.js';

const TEXTS = saveChoiceMessages('nn', false);
/** A chosen MultiChoice option (the probe P3 learner's selector, H5P's own markup). */
const CHOSEN = '.h5p-answer[aria-checked="true"]';

/**
 * Records every text of the editor page's status region from now on, so a short-lived text (the running reset) is
 * seen however fast the request is; read with {@link statusTexts}.
 */
const watchStatus = (editor: Frame): Promise<void> =>
  editor.evaluate(() => {
    const status = document.getElementById('hvl-editor-status') as HTMLElement;
    const log: string[] = [];
    Object.assign(window, { hvliStatusTexts: log });
    const observer = new MutationObserver(() => log.push(status.textContent ?? ''));
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  });

/** The status texts {@link watchStatus} recorded, in order. */
const statusTexts = (editor: Frame): Promise<string[]> =>
  editor.evaluate(() => [...(window as unknown as { hvliStatusTexts: string[] }).hvliStatusTexts]);

/** The student's view of the player inside `/app/play`: options and chosen options, once H5P has started. */
async function playerView(player: Frame): Promise<{ options: number; chosen: number }> {
  await player.waitForFunction(
    () => (window as unknown as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length,
    undefined,
    { timeout: 30_000 },
  );
  await player.locator('.h5p-answer').first().waitFor();
  return {
    options: await player.locator('.h5p-answer').count(),
    chosen: await player.locator(CHOSEN).count(),
  };
}

describeWithRealWebApp(
  '[PROD-013] a structural edit with a student’s saved progress, reset from the portal',
  () => {
    let browser: Browser;
    let app: RealWebApp;
    let contentId: string;
    beforeAll(async () => {
      browser = await chromium.launch();
      app = await openRealWebApp(browser);
      contentId = app.ids.get('H5P.MultiChoice') ?? '';
    }, 240_000);
    afterAll(async () => {
      await app?.close();
      await browser?.close();
    });

    it('[PROD-013] the student’s state survives a relaunch, the author resets it in the dialog, and the next launch starts fresh', async () => {
      // Arrange: the student and the author each in a browser of their own
      const student = await browser.newContext();
      const author = await browser.newContext({ storageState: app.authorStorage });
      const authorPage = await author.newPage();
      const flow = await recordFlow(authorPage, app.base, {
        // WHY: the refused structural save is this flow's expected 409, which Chromium logs as a failed resource.
        ignoreConsole: (m) =>
          m.text().includes('409') && m.location().url.endsWith(`/h5p/content/${contentId}`),
      });
      const states = () => app.tb.db.h5PUserData.findMany({ where: { contentId, dataType: 'state' } });
      const facts = async () => ({
        stateRows: (await states()).length,
        studentErrors,
        ...(await lostRowsFact(app.tb.db, {
          users: { 'the author': app.authorId },
          contents: { 'the activity': contentId },
        })),
      });
      const studentErrors: string[] = [];
      const launch = async () => {
        const page = await student.newPage();
        page.on('pageerror', (error) => studentErrors.push(error.message));
        const ltik = await app.launch(contentId);
        await page.goto(`${app.base}/app/play?ltik=${encodeURIComponent(ltik)}`);
        return { page, player: await frameAt(page, '/lti/play') };
      };
      const seen = await flow.run(async () => {
        // Act: the student answers with the second option; H5P saves the state
        flow.step = 'student answers';
        const first = await launch();
        await playerView(first.player);
        await first.player.locator('.h5p-answer').nth(1).click();
        await expect
          .poll(async () => JSON.stringify((await states()).map((r) => r.data)), { timeout: 30_000 })
          .toContain('[1]');
        await first.page.close({ runBeforeUnload: false });
        flow.step = 'student resumes';
        const second = await launch();
        const resumed = await playerView(second.player);
        await second.page.close({ runBeforeUnload: false });
        // Act: the author adds an option on Rediger and saves; the save choice opens
        flow.step = 'structural edit';
        await authorPage.goto(`${app.base}/aktivitet/${contentId}?fane=edit`);
        const { editor, form } = await editorFrames(authorPage, contentId);
        const options = await addOption(form);
        const refusal = await pressEditorSave(authorPage, editor, contentId);
        await editor.locator('dialog[open]').waitFor({ timeout: 20_000 });
        // WHY: the portal page makes itself inert when the editor's message arrives, a moment after the dialog opens.
        const inert = () => authorPage.locator('[inert]').count();
        await expect.poll(inert, { timeout: 10_000 }).toBeGreaterThan(0);
        const inertWhileOpen = await inert();
        // Act: «Nullstill framgangen og lagre»
        flow.step = 'reset';
        await watchStatus(editor);
        await editor.getByRole('button', { name: TEXTS.reset }).click();
        await expect
          .poll(() => editor.textContent('#hvl-editor-status'), { timeout: 30_000 })
          .toBe(TEXTS.resetAndSaved);
        const announced = await statusTexts(editor);
        const inertAfter = await authorPage.locator('[inert]').count();
        const stateRowsAfterReset = (await states()).length;
        // Act: the student's next launch
        flow.step = 'student relaunches';
        const third = await launch();
        const fresh = await playerView(third.player);
        await third.page.close({ runBeforeUnload: false });
        const refusalStatus = refusal.status();
        return {
          resumed,
          options,
          refusalStatus,
          inertWhileOpen,
          announced,
          inertAfter,
          stateRowsAfterReset,
          fresh,
        };
      }, facts);
      const stored = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
      // Assert: the state was really kept between launches before the edit
      expect(seen.resumed).toEqual({ options: seen.options - 1, chosen: 1 });
      // Assert: the structural save was refused until the author chose; the page was inert meanwhile
      expect(seen.refusalStatus).toBe(409);
      expect(seen.inertWhileOpen).toBeGreaterThan(0);
      // Assert: the status region said that the reset runs, then that it is done (WCAG 4.1.3)
      expect(seen.announced).toEqual([TEXTS.resetting, TEXTS.resetAndSaved]);
      expect(seen.inertAfter).toBe(0);
      // Assert: saved with the new option, the state gone, the version raised; the student starts fresh
      expect(seen.stateRowsAfterReset).toBe(0);
      expect(stored.version).toBe(2);
      expect((stored.params as { answers: unknown[] }).answers).toHaveLength(seen.options);
      expect(seen.fresh).toEqual({ options: seen.options, chosen: 0 });
      expect([...flow.problems, ...studentErrors]).toEqual([]);
      await student.close();
      await author.close();
    }, 240_000);
  },
);
