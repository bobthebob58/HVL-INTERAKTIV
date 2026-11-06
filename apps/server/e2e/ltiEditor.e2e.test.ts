/**
 * End-to-end test of the H5P editor inside the Canvas iframe with third-party cookies blocked (LTI-006
 * **Rediger**): the owner launches their activity, opens `/lti/edit` in the tool frame, and saves with the ltik as
 * a Bearer token; no tool cookie, no ltik left in the address bar, no failed request. Full Chromium, the whole
 * server and the mock Canvas. It saves once «Lagre» is enabled (src/h5p/render/client/editorStart.js) and repeats a
 * click that sent nothing (./support/editorSave.ts), as ./appPlayEditor.e2e.test.ts does.
 *
 * Spec: LTI-006, LTI-003, H5P-007
 */
import type { Browser, Frame } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../test/support/appTestbed.js';
import { launchFromCanvas } from '../test/support/ltiLaunchDriver.js';
import { describeWithServices } from '../test/support/services.js';
import { recordFlow, redactTokens } from '../test/support/flowRecorder.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { pressEditorSave } from './support/editorSave.js';

/** The ltik H5P's AJAX URL carries on the tool's player page (the address bar no longer has it). */
async function ltikOf(frame: Frame): Promise<string> {
  const text = await frame.locator('#h5p-integration').textContent();
  const ajaxPath = (JSON.parse(text ?? '{}') as { ajaxPath?: string }).ajaxPath ?? '';
  return new URL(ajaxPath, 'http://tool.invalid').searchParams.get('ltik') ?? '';
}

describeWithServices('[LTI-006] the H5P editor in the Canvas iframe with third-party cookies blocked', () => {
  let tb: AppTestbed;
  let contentId: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    // Arrange: the teacher's first launch creates their account; they then own an activity
    const first = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user: CANVAS_USERS.teacher,
      custom: { contentId: await tb.activity(await tb.staffAccount(), { published: true }) },
      resourceLinkId: 'e2e-edit-first',
    });
    const { principal } = await tb.lti.resolveLtik(first.ltik ?? '');
    contentId = await tb.activity(principal.userId, { published: true, title: 'Mi eiga' });
  }, 60_000);
  afterAll(() => tb?.close());

  describe.each([
    ['stock Chrome: partitioned frame storage', true, false],
    ['frame storage blocked: LTI Platform Storage', false, true],
  ])('%s', (_name, partitionedStorage, platformStorage) => {
    let browser: Browser;
    beforeAll(async () => {
      browser = await launchCookieTestChromium({ partitionedStorage });
    });
    afterAll(() => browser?.close());

    it('[LTI-006] the owner opens the editor from the launch and saves with the Bearer ltik', async () => {
      // Arrange: launch into the player, as Canvas does
      const context = await browser.newContext();
      const page = await context.newPage();
      // WHY: the record sees the Set-Cookie headers the blocked browser drops; the jar alone cannot show them.
      const flow = await recordFlow(page, tb.toolUrl);
      const problems: string[] = [];
      const spec: LaunchSpec = {
        user: CANVAS_USERS.teacher,
        custom: { contentId },
        resourceLinkId: `e2e-edit-${String(platformStorage)}`,
        platformStorage,
      };
      await page.goto(tb.mock.canvas.coursePageUrl(spec));
      await page
        .frameLocator('#tool_content')
        .locator('#h5p-integration')
        .waitFor({ state: 'attached', timeout: 30_000 });
      const frame = page.frame({ name: 'tool_content' });
      if (!frame) throw new Error('no tool frame');
      const ltik = await ltikOf(frame);
      // WHY: the synthetic test type reports errors while the player unloads; only the editor's are under test.
      await frame.goto('about:blank');
      // Act: open the editor in the same frame and save
      page.on('console', (m) => {
        // WHY: the mock Canvas frame does not delegate fullscreen, as Canvas's own `allow` list does.
        if (m.type() === 'error' && !m.text().includes('fullscreen is not allowed'))
          problems.push(redactTokens(m.text()));
      });
      page.on('pageerror', (e) => problems.push(e.message));
      await frame.goto(`${tb.toolUrl}/lti/edit?ltik=${encodeURIComponent(ltik)}`);
      // WHY: «Lagre» is enabled only once H5P's editor can save: the page's own signal, not H5P's markup.
      await frame
        .locator('#hvl-editor-save:enabled')
        .waitFor({ timeout: 30_000 })
        .catch((error: unknown) => {
          throw new Error(`editor did not start: ${problems.join(' | ')}`, { cause: error });
        });
      const response = await pressEditorSave(page, frame, contentId);
      // Assert
      expect(response.status()).toBe(200);
      expect(response.request().headers().authorization).toMatch(/^Bearer \S+$/);
      expect(new URL(frame.url()).pathname).toBe('/lti/edit');
      expect(frame.url()).not.toContain('ltik=');
      await expect.poll(() => frame.textContent('#hvl-editor-status')).toBe('Lagra.');
      expect(await context.cookies(tb.toolUrl)).toEqual([]);
      await flow.settled();
      expect(flow.setCookies).toEqual([]);
      expect(flow.failed).toEqual([]);
      expect(problems).toEqual([]);
      await context.close();
    }, 90_000);
  });
});
