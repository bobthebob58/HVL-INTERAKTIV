/**
 * End-to-end test of the web app's Canvas page (`/app/play`, LTI-006) in the mock Canvas iframe with third-party
 * cookies and frame storage blocked (LTI Platform Storage, LTI-003): the teacher who owns the activity launches it,
 * sees the tabs **Spel** and **Rediger**, opens the editor (`/lti/edit`) inside the page's chrome and saves with the
 * ltik as a Bearer token; the player reloads, the tool sends no Set-Cookie, and no frame keeps the ltik in its
 * address. Full Chromium (D-065), the whole server with the built web app and the real content types. A failed
 * step names itself, what failed before it and whether another process removed this flow's rows
 * (../test/support/flowRecorder.ts, ../test/support/lostTestRows.ts). It saves once «Lagre» is enabled, which the
 * editor page does only when H5P's editor can save (src/h5p/render/client/editorStart.js), and repeats a click that
 * sent nothing (./support/editorSave.ts): CI run 41075981429 lost one that landed in H5P's growing iframe.
 *
 * Spec: LTI-006, LTI-003, H5P-007, DATA-011
 */
import { join } from 'node:path';
import type { Browser, Frame, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { asAccountUser } from '../src/h5p/HvlH5pUser.js';
import { recordFlow, redactTokens } from '../test/support/flowRecorder.js';
import { lostRowsFact } from '../test/support/lostTestRows.js';
import { REAL_PACKAGES_DIR } from '../test/support/realPackages.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { testActor } from '../test/support/testActors.js';
import { launchCookieTestChromium, startCookieCanary } from '../test/support/thirdPartyCookies.js';
import { pressEditorSave } from './support/editorSave.js';

/** The path of a frame's current address (`about:blank` has none of ours). */
const pathOf = (url: string): string => (url.startsWith('http') ? new URL(url).pathname : url);

/**
 * Waits for the live frame at `path` and, for a player, until H5P has started the activity in it.
 * @param page - The mock Canvas page.
 * @param path - `/lti/play` or `/lti/edit`.
 * @returns The frame.
 */
async function frameAt(page: Page, path: string): Promise<Frame> {
  const find = () => page.frames().find((frame) => !frame.isDetached() && pathOf(frame.url()) === path);
  await expect.poll(() => find() !== undefined, { timeout: 30_000 }).toBe(true);
  const frame = find() as Frame;
  if (path === '/lti/play') {
    await frame.waitForFunction(
      () => (window as unknown as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length,
      undefined,
      { timeout: 30_000 },
    );
  }
  return frame;
}

describeWithRealWebApp('[LTI-006] the Canvas page with Spel and Rediger, frame storage blocked', () => {
  let browser: Browser;
  let app: RealWebApp;
  let contentId: string;
  let teacherId: string;
  let title: string;
  beforeAll(async () => {
    // WHY: Playwright's Chromium does not partition storage, so the blocked tool frame has no localStorage (D-065).
    browser = await launchCookieTestChromium();
    app = await openRealWebApp(browser);
    // Arrange: the teacher's first launch creates their account; they then own a published activity
    const first = await app.launch(app.ids.get('H5P.MultiChoice') ?? '', { teacher: true });
    teacherId = (await app.tb.lti.resolveLtik(first)).principal.userId;
    const teacher = asAccountUser(testActor('author', { accountId: teacherId }));
    const { packageImporter } = app.tb.runtime.editor;
    const imported = await packageImporter.addPackageLibrariesAndContent(
      join(REAL_PACKAGES_DIR, 'H5P.MultiChoice.h5p'),
      teacher,
    );
    contentId = String(imported.id);
    const row = await app.tb.db.h5PContent.update({
      where: { id: contentId },
      data: { status: 'published', visibility: 'organisation' },
    });
    title = row.title;
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[LTI-003] the browser really blocks third-party cookies and frame storage (canary)', async () => {
    // Arrange
    const canary = await startCookieCanary();
    const page = await browser.newPage();
    // Act
    const report = await canary.open(page);
    await page.close();
    await canary.close();
    // Assert
    expect(report.documentCookie).toBe('');
    expect(report.followUpCookie).toBe('');
    expect(report.localStorage).not.toBe('ok');
  });

  it('[LTI-006][LTI-003] the owner plays, opens Rediger inside the Canvas page and saves with the Bearer ltik', async () => {
    // Arrange: record failed requests, console and page errors, policy violations and Set-Cookie headers
    const context = await browser.newContext();
    const page = await context.newPage();
    const spec: LaunchSpec = {
      user: CANVAS_USERS.teacher,
      custom: { contentId },
      resourceLinkId: 'e2e-app-play-editor',
      platformStorage: true,
    };
    const coursePage = app.tb.mock.canvas.coursePageUrl(spec);
    const canvasOrigin = new URL(coursePage).origin;
    const flow = await recordFlow(page, app.base, {
      // WHY: the mock Canvas page is not under test (its favicon is a 404), and its frame does not delegate
      // fullscreen, as Canvas's own `allow` list does.
      ignoreConsole: (m) =>
        m.location().url.startsWith(canvasOrigin) || m.text().includes('fullscreen is not allowed'),
    });
    const savePath = `/h5p/content/${contentId}`;
    let editorFrame: Frame | undefined;
    const facts = async () => ({
      saveRequestSent: flow.requests.includes(`PUT ${savePath}`),
      editorStatus: await editorFrame
        ?.textContent('#hvl-editor-status', { timeout: 1_000 })
        .catch(() => 'unreadable'),
      saveDisabled: await editorFrame
        ?.isDisabled('#hvl-editor-save', { timeout: 1_000 })
        .catch(() => 'unreadable'),
      ...(await lostRowsFact(app.tb.db, {
        users: { 'the teacher': teacherId },
        contents: { 'the activity': contentId },
        platformId: app.tb.platformId,
      })),
    });
    const seen = await flow.run(async () => {
      // Act: launch from the course page, as Canvas does
      flow.step = 'launch';
      await page.goto(coursePage);
      const tool = page.frameLocator('#tool_content');
      await tool.getByRole('heading', { level: 1, name: title }).waitFor({ timeout: 30_000 });
      const toolFrame = page.frame({ name: 'tool_content' });
      if (!toolFrame) throw new Error('no tool frame');
      const tabs = await tool.getByRole('tab').allTextContents();
      flow.step = 'player';
      const playerBefore = await frameAt(page, '/lti/play');
      // Act: open Rediger and save
      flow.step = 'editor';
      await tool.getByRole('tab', { name: 'Rediger' }).click();
      const editor = (editorFrame = await frameAt(page, '/lti/edit'));
      // WHY: «Lagre» is enabled only once H5P's editor can save; a visible form was all this waited for when CI
      // run 41075981429 failed. H5P still grows its iframe above «Lagre» afterwards (fields that come with a later
      // request), so a click can land in that iframe, where Playwright's hit check cannot see it: pressEditorSave
      // repeats only a click that sent nothing.
      await editor.locator('#hvl-editor-save:enabled').waitFor({ timeout: 45_000 });
      flow.step = 'save';
      const response = await pressEditorSave(page, editor, contentId);
      await expect.poll(() => editor.textContent('#hvl-editor-status')).toBe('Lagra.');
      // Act: the saved activity reloads in the player
      flow.step = 'player reload';
      await expect.poll(() => playerBefore.isDetached(), { timeout: 15_000 }).toBe(true);
      await frameAt(page, '/lti/play');
      return { toolFrame, tabs, editor, response };
    }, facts);
    await flow.settled();
    const authorization = seen.response.request().headers().authorization ?? '';
    const bearerOwner = (await app.tb.lti.resolveLtik(authorization.replace(/^Bearer /, ''))).principal
      .userId;
    // Assert: the Canvas page, its tabs and the editor inside its chrome
    expect(pathOf(seen.toolFrame.url())).toBe('/app/play');
    expect(seen.tabs).toEqual(['Spel', 'Rediger']);
    expect(seen.editor.parentFrame()).toBe(seen.toolFrame);
    // Assert: the save used the teacher's ltik as Bearer; no cookie, no ltik in any address, nothing failed
    expect(seen.response.status()).toBe(200);
    expect(redactTokens(authorization)).toBe('Bearer [redacted]');
    expect(bearerOwner).toBe(teacherId);
    expect(flow.setCookies).toEqual([]);
    expect(await context.cookies(app.base)).toEqual([]);
    const ltikAddresses = page.frames().filter((frame) => frame.url().includes('ltik'));
    expect(ltikAddresses.map((frame) => redactTokens(frame.url()))).toEqual([]);
    expect(flow.failed).toEqual([]);
    expect(flow.problems).toEqual([]);
    await context.close();
  }, 120_000);
});
