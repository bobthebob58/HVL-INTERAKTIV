/**
 * Probe P7 (S5): the save choice dialog of PROD-013 in a framed editor page, as authors always meet it: `/lti/edit`
 * inside a Canvas page from another origin (D-093, D-098), and `/h5p/edit` inside the web app's activity page on
 * our own origin (the Rediger tab, apps/web/src/features/activity/ActivityView.tsx). Both send the strict policy.
 *
 * Found: showModal works in the frame, but it is modal only inside the frame: the page around it stays live, and
 * natively Tab moves on from the last button to that page's next link while the dialog stays open. Wrapping Tab
 * in the dialog keeps focus in it; Escape then cancels and focus returns to «Lagre». The guard that takes focus
 * back from the H5P editor iframe must act only when focus went into a frame of ours; one that answers every
 * window `blur` also takes focus back from the page around ours, and the keys typed there land in the dialog.
 *
 * Spec: PROD-013, UD-006
 */
import type { Frame, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { describeWithBrowser } from '../../support/browser.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import {
  armProbe,
  clickUntilOpen,
  eventually,
  openDialogBench,
  type DialogBench,
  type ProbeOptions,
} from './editorSaveDialogBench.js';
import {
  focusIn,
  loadProbeScript,
  probeLog,
  routeProbeFiles,
  SAVE_CHOICE_TEXTS,
} from './editorSaveDialogPage.js';

const [RESET, COPY, CANCEL] = SAVE_CHOICE_TEXTS.choices.map((c) => `tool:hvl-save-choice-${c.value}`);

/** Where focus is: the outer page's own element, or `tool:<id>` inside our framed editor page. */
const focusAt = async (page: Page, tool: Frame): Promise<string> => {
  const top = await page.evaluate(() => {
    const active = document.activeElement;
    return active?.tagName === 'IFRAME' ? 'IFRAME' : active?.id || active?.tagName;
  });
  return top === 'IFRAME' ? `tool:${(await focusIn(tool)).at}` : String(top);
};

/** Presses `key` `times` times and records where focus went each time. */
const walk = async (page: Page, tool: Frame, key: string, times: number): Promise<string[]> => {
  const stops: string[] = [];
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    stops.push(await focusAt(page, tool));
  }
  return stops;
};

/** Frames the editor page between two links and before a text field of `page`, and loads the probe in it. */
const frameEditor = async (page: Page, src: string): Promise<{ tool: Frame; editor: Frame }> => {
  await page.evaluate((url) => {
    const link = (id: string) =>
      Object.assign(document.createElement('a'), { id, href: `#${id}`, textContent: id });
    const frame = Object.assign(document.createElement('iframe'), {
      id: 'tool_content',
      name: 'tool_content',
    });
    Object.assign(frame, { src: url, title: 'HVL Interaktiv' });
    frame.style.cssText = 'width: 900px; height: 500px';
    const field = Object.assign(document.createElement('input'), { id: 'outer-field' });
    field.setAttribute('aria-label', 'outer-field');
    document.body.prepend(link('outer-before'));
    document.body.append(frame, link('outer-after'), field);
  }, src);
  const editorForm = page.frameLocator('#tool_content').frameLocator('iframe.h5p-editor-iframe');
  await editorForm.locator('.h5peditor-form').first().waitFor({ timeout: 30_000 });
  const tool = page.frame({ name: 'tool_content' });
  const editor = tool?.childFrames()[0];
  if (!tool || !editor || !(await loadProbeScript(tool))) throw new Error('no editor frame with the probe');
  return { tool, editor };
};

/** Arms the probe and clicks «Lagre» once it stands still, as ./editorSaveDialogBench.ts opens it by mouse. */
const openIn = async (tool: Frame, options: ProbeOptions): Promise<void> => {
  await armProbe(tool, options);
  await clickUntilOpen(tool);
};

/** A script in the H5P editor iframe focuses its first field; true if it did (only then can the guard act). */
const editorTakesFocus = (editor: Frame) =>
  editor.evaluate(() => {
    document.querySelector<HTMLElement>('.h5peditor-form input')?.focus();
    return document.activeElement?.matches('.h5peditor-form input') === true;
  });

describeWithServices('[PROD-013] the save choice dialog in Canvas’s frame (probe P7)', () => {
  let tb: AppTestbed;
  let ltik: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    const launch = async (contentId: string, resourceLinkId: string) =>
      (
        await launchFromCanvas(tb.app, tb.mock.canvas, {
          user: CANVAS_USERS.teacher,
          custom: { contentId },
          resourceLinkId,
        })
      ).ltik ?? '';
    // WHY: the teacher's first launch creates their account; then they own an activity to edit.
    const first = await launch(await tb.activity(await tb.staffAccount(), { published: true }), 'p7-first');
    const { principal } = await tb.lti.resolveLtik(first);
    ltik = await launch(await tb.activity(principal.userId, { published: true }), 'p7-edit');
  }, 60_000);
  afterAll(() => tb?.close());

  describeWithBrowser('[UD-006] the dialog in the tool frame of a Canvas page', (browser) => {
    it('[PROD-013] it is modal only in the frame: Tab moves on to Canvas’s page, unless the dialog wraps Tab', async () => {
      // Arrange: Canvas's page with our editor frame between two of Canvas's own links
      const context = await browser().newContext();
      await routeProbeFiles(context, tb.toolUrl);
      const page = await context.newPage();
      await page.goto(tb.mock.canvas.origin);
      const edit = page.waitForResponse((r) => new URL(r.url()).pathname === '/lti/edit');
      const { tool, editor } = await frameEditor(
        page,
        `${tb.toolUrl}/lti/edit?ltik=${encodeURIComponent(ltik)}`,
      );
      // Act: natively
      await openIn(tool, {});
      const initial = await focusAt(page, tool);
      const hits = await page.evaluate(() => {
        const box = document.getElementById('outer-after')?.getBoundingClientRect();
        return box ? document.elementFromPoint(box.left + 2, box.top + 2)?.id : 'missing';
      });
      const nativeTab = await walk(page, tool, 'Tab', 1);
      const stillOpen = await tool.evaluate(() => document.querySelector('dialog')?.open);
      await tool.evaluate(() => document.querySelector('dialog')?.close());
      // Act: with Tab wrapped and the frame-focus guard, then a script in the H5P frame takes focus, then Escape
      await openIn(tool, { wrapTab: true, guardFrameFocus: true });
      const wrappedTab = await walk(page, tool, 'Tab', 3);
      const wrappedShiftTab = await walk(page, tool, 'Shift+Tab', 3);
      expect(await editorTakesFocus(editor)).toBe(true);
      await eventually(() => focusAt(page, tool)).toBe(CANCEL);
      await page.keyboard.press('Escape');
      await eventually(() => probeLog(tool).then((l) => l.log.at(-2))).toBe('cancel');
      // Assert: the same strict policy as the portal's editor page (D-070)
      expect(await (await edit).headerValue('content-security-policy')).toMatch(/script-src 'self' 'sha256-/);
      expect(initial).toBe(CANCEL);
      expect(hits).toBe('outer-after');
      expect(nativeTab).toEqual(['outer-after']);
      expect(stillOpen).toBe(true);
      expect(wrappedTab).toEqual([RESET, COPY, CANCEL]);
      expect(wrappedShiftTab).toEqual([COPY, RESET, CANCEL]);
      expect(await focusAt(page, tool)).toBe('tool:hvl-editor-save');
      await context.close();
    }, 120_000);
  });
});

describeWithServices('[PROD-013] the save choice dialog in the web app’s Rediger frame (probe P7)', () => {
  describeWithRealPackages('[PROD-013] the real editor page framed on our origin', () => {
    let bench: DialogBench;
    beforeAll(async () => {
      bench = await openDialogBench();
    }, 180_000);
    afterAll(() => bench?.close());

    describeWithBrowser('[UD-006] the dialog in the frame of the activity page', (browser) => {
      it('[PROD-013] Tab leaves for the web app’s page too; the frame-focus guard leaves focus there alone', async () => {
        // Arrange: a page of ours frames the editor page, as ActivityView.tsx's Rediger tab does
        const context = await browser().newContext();
        await context.setExtraHTTPHeaders({ [bench.authorHeader[0]]: bench.authorHeader[1] });
        const outer = `${bench.base}/p7-activity-page`;
        await context.route(outer, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
        const page = await context.newPage();
        await page.goto(outer);
        const { tool, editor } = await frameEditor(page, `${bench.base}/h5p/edit/${bench.contentId}`);
        // Act
        await openIn(tool, {});
        const nativeTab = await walk(page, tool, 'Tab', 1);
        const stillOpen = await tool.evaluate(() => document.querySelector('dialog')?.open);
        await tool.evaluate(() => document.querySelector('dialog')?.close());
        await openIn(tool, { wrapTab: true, guardFrameFocus: true });
        expect(await editorTakesFocus(editor)).toBe(true);
        await eventually(() => focusAt(page, tool)).toBe(CANCEL);
        await page.click('#outer-field');
        await page.keyboard.type('abc');
        // WHY: an absence check (nothing may take focus back), so the wait stays fixed. A guard that answers every
        // blur takes focus back in a timer of the tool frame; 500 ms timed there fire after any shorter timer it set.
        await tool.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
        // Assert
        expect(nativeTab).toEqual(['outer-after']);
        expect(stillOpen).toBe(true);
        expect(await page.inputValue('#outer-field')).toBe('abc');
        expect(await focusAt(page, tool)).toBe('outer-field');
        await context.close();
      }, 120_000);
    });
  });
});
