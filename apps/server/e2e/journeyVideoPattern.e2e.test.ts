/**
 * End-to-end test of journey J1's video steps in the portal, in Chromium (spec 00 §3 J1 steps 2–5): the signed-in
 * Feide author opens the pattern `fa-video` on `/laeringsdesign` and creates an activity from it; the H5P editor opens
 * on **Rediger** with the Interactive Video skeleton (three check questions at 150, 300 and 450 s and a summary
 * task); **Sjekk og publiser** reports the missing video as V-PLACEHOLDER and no V-VID-CAPTIONS yet; «Gå til feltet»
 * puts focus on H5P's «add video» control, the author pastes a Panopto link in H5P's own dialog, inserts and saves;
 * the stored parameters then hold the link, and the check reports V-VID-CAPTIONS (the Panopto site is not listed as
 * captioned) instead of the missing video. The pattern is chosen by its ID, its name read from `GET /api/studio`
 * (D-082). Every request off this machine is refused and recorded, so none reaches the internet. The whole server
 * with the built web app and the real content types (../test/support/realWebApp.ts).
 *
 * Spec: PROD-001, PROD-003, UD-021
 */
import type { StudioOverview } from '@hvl-interaktiv/api-contract';
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { validationMessage } from '../src/validation/validationMessages.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { webText, webTextPattern } from '../test/support/webAppTexts.js';
import { pressEditorSave } from './support/editorSave.js';
import { deepFocus, editorFrames } from './support/portalFrames.js';

const PATTERN_ID = 'fa-video';
const COURSE = 'E2E101';
const PANOPTO =
  'https://hvl.cloud.panopto.eu/Panopto/Pages/Viewer.aspx?id=6b2a6a0c-0000-4000-8000-000000000001';
/** A finding's first line as FindingsList writes it: icon, severity and message. */
const ERROR = (key: Parameters<typeof validationMessage>[0]) =>
  `${webText('severity.error')}: ${validationMessage(key)}`;
const VIDEO_MISSING = ERROR('V-PLACEHOLDER.videoMissing');
const NO_CAPTIONS = ERROR('V-VID-CAPTIONS.missing');
const CAPTIONS_RULE = webText('findings.rule', { ruleId: 'V-VID-CAPTIONS' });
const PLACEHOLDER_RULE = webText('findings.rule', { ruleId: 'V-PLACEHOLDER' });

/** The parts of the stored Interactive Video this test reads. */
interface StoredVideo {
  interactiveVideo: {
    video: { files?: { path: string; mime: string }[] };
    assets: { interactions: { duration: { from: number }; action: { library: string } }[] };
    summary: { task: { library: string } };
  };
}

describeWithRealWebApp(
  '[PROD-001] J1 in the portal: the video pattern, a Panopto link and the captions check',
  () => {
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

    it('[PROD-001][PROD-003][UD-021] create from the video pattern, paste a Panopto link, see the captions error', async () => {
      // Arrange: the pattern by its ID; a page that may not reach anything off this machine
      const overview = (await (await fetch(`${app.base}/api/studio`)).json()) as StudioOverview;
      const target = overview.patterns.find((p) => p.id === PATTERN_ID);
      if (!target?.available) throw new Error(`pattern ${PATTERN_ID} is not available in content/`);
      const context = await browser.newContext({ storageState: app.authorStorage });
      // WHY: the editor must need nothing from Panopto to take a link; a request that tries is refused and named.
      const offMachine: string[] = [];
      await context.route(/^https?:\/\/(?!(files\.)?localhost[:/])/, (route) => {
        offMachine.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      const flow = await recordFlow(page, app.base);
      const tab = (key: string) => page.getByRole('tab', { name: webText(key) });
      const errorsRegion = page.getByRole('region', { name: webTextPattern('findings.groupError') });
      const errorItems = () => errorsRegion.getByRole('listitem').allTextContents();
      const facts = async () => ({ offMachine, focus: await deepFocus(page).catch(() => 'unreadable') });
      const seen = await flow.run(async () => {
        // Act: open the pattern from the catalogue and create an activity with a course code
        flow.step = 'create';
        await page.goto(`${app.base}/laeringsdesign`);
        const catalogue = page.getByRole('region', { name: webText('studio.catalogueHeading') });
        await catalogue.getByRole('link', { name: target.name.nn, exact: true }).click();
        await page.getByRole('heading', { level: 1, name: target.name.nn }).waitFor({ timeout: 30_000 });
        await page.getByRole('textbox', { name: webText('patterns.courseCode') }).fill(COURSE);
        await page.getByRole('button', { name: webText('patterns.submit') }).click();
        await page.waitForURL(/\/aktivitet\/[0-9a-f-]{36}\?fane=edit$/, { timeout: 60_000 });
        const contentId = new URL(page.url()).pathname.split('/').pop() ?? '';
        // Act: H5P's form as the teacher sees it: Interactive Video's editor with its three wizard steps
        flow.step = 'skeleton';
        const { editor, form } = await editorFrames(page, contentId);
        const ivEditors = await form.locator('.h5p-interactivevideo-editor').count();
        const wizardSteps = await form
          .locator('.field-name-interactiveVideo.wizard .h5peditor-tab-a')
          .evaluateAll((tabs) =>
            tabs.map((a) => [...a.classList].find((c) => /^h5peditor-tab-(?!a$)/.test(c))),
          );
        const created = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
        // Act: the check before a video is there
        flow.step = 'check without a video';
        await tab('activity.tabCheck').click();
        await errorsRegion.waitFor({ timeout: 30_000 });
        const before = await errorItems();
        // Act: «Gå til feltet» on the missing video, then H5P's own «add video» dialog
        flow.step = 'paste a Panopto link';
        const videoFinding = errorsRegion.getByRole('listitem').filter({ hasText: VIDEO_MISSING });
        await videoFinding.getByRole('button', { name: webText('findings.goToField') }).click();
        await expect
          .poll(() => deepFocus(page), { timeout: 45_000 })
          .toMatchObject({ className: 'h5p-add-file' });
        // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor-av.js
        // (`createInsertDialog`): the add control is a div[role=button] that opens `.h5p-add-dialog` with a URL
        // field `.h5p-file-url` and the button `.h5p-insert`.
        const videoField = form.locator('.field-name-files.video');
        await videoField.locator('.h5p-add-file').click();
        await videoField.locator('.h5p-add-dialog.h5p-open .h5p-file-url').fill(PANOPTO);
        await videoField.locator('.h5p-add-dialog.h5p-open .h5p-insert').click();
        const fileType = await videoField.locator('.file .h5p-type').textContent();
        const saved = await pressEditorSave(page, editor, contentId);
        await page.getByRole('status').getByText(webText('activity.saved'), { exact: true }).waitFor();
        // Act: the check with the Panopto video
        flow.step = 'check with a video';
        await tab('activity.tabCheck').click();
        await expect
          .poll(async () => (await errorItems()).some((item) => item.includes(NO_CAPTIONS)))
          .toBe(true);
        const after = await errorItems();
        return { contentId, ivEditors, wizardSteps, created, before, fileType, saved, after };
      }, facts);
      const { contentId, created, before, after } = seen;
      const createdParams = created.params as unknown as StoredVideo;
      const row = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
      const stored = (row.params as unknown as StoredVideo).interactiveVideo;
      // Assert: the skeleton: Interactive Video with three questions at 150, 300 and 450 s and a summary task
      expect(created.mainLibrary).toBe('H5P.InteractiveVideo');
      const interactions = createdParams.interactiveVideo.assets.interactions;
      expect(interactions.map((i) => i.duration.from)).toEqual([150, 300, 450]);
      expect(interactions.map((i) => i.action.library.split(' ')[0])).toEqual([
        'H5P.MultiChoice',
        'H5P.Blanks',
        'H5P.MultiChoice',
      ]);
      expect(createdParams.interactiveVideo.summary.task.library).toMatch(/^H5P\.Summary /);
      expect(createdParams.interactiveVideo.video.files ?? []).toEqual([]);
      expect(seen.ivEditors).toBe(1);
      expect(seen.wizardSteps).toEqual([
        'h5peditor-tab-video',
        'h5peditor-tab-assets',
        'h5peditor-tab-summary',
      ]);
      // Assert: without a video, the missing video is a V-PLACEHOLDER error and the captions rule is silent
      const missing = before.filter((item) => item.includes(VIDEO_MISSING));
      expect(missing).toHaveLength(1);
      expect(missing[0]).toContain(PLACEHOLDER_RULE);
      expect(before.some((item) => item.includes(CAPTIONS_RULE))).toBe(false);
      // Assert: H5P took the link as a Panopto source, and the save stored it as the video file
      expect(seen.fileType).toBe('Panopto');
      expect(seen.saved.status()).toBe(200);
      expect(stored.video.files).toEqual([expect.objectContaining({ path: PANOPTO, mime: 'video/Panopto' })]);
      // Assert: with the video, V-VID-CAPTIONS is reported in Nynorsk and the missing video is gone
      const captions = after.filter((item) => item.includes(CAPTIONS_RULE));
      expect(captions).toHaveLength(1);
      expect(captions[0]).toContain(NO_CAPTIONS);
      expect(after.some((item) => item.includes(VIDEO_MISSING))).toBe(false);
      expect(after).toHaveLength(before.length);
      // Assert: nothing left the machine, and the flow saw no failed request or console error
      expect(offMachine).toEqual([]);
      expect(flow.failed).toEqual([]);
      expect(flow.problems).toEqual([]);
      await context.close();
    }, 300_000);
  },
);
