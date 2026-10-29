/**
 * End-to-end test of the pedagogisk mappe in Chromium (MAPPE-001, MAPPE-002, MAPPE-004, D-094, D-096): a signed-in
 * author with activities opens `/mappe`, chooses two of them, hears the Del 1 word count in a status region, and
 * downloads the Markdown and the PDF (the browser's own download events). The files are not empty; the Markdown names
 * the chosen activities; the PDF starts with `%PDF` and pdf.js finds the Markdown's first heading as its title. The
 * export is made when it is asked for and kept nowhere: no storage object, no activity and no audit event is added.
 * The whole server with the built web app and the real content types (../test/support/realWebApp.ts), and the
 * repository's own mappe template and criteria, whose texts it never asserts (Q17).
 *
 * Spec: MAPPE-001, MAPPE-002, MAPPE-004, MAPPE-003
 */
import { readFile } from 'node:fs/promises';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { chromium, type Browser, type Download, type Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createS3Client } from '../src/infra/s3Client.js';
import { firstTopHeading } from '../src/learningDesign/mappe/mappeWordCount.js';
import { runsAsRoot } from '../test/learningDesign/mappe/taggedPdfLaunchRunner.js';
import { readTaggedPdf } from '../test/learningDesign/mappe/taggedPdfReader.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { webText, webTextPattern } from './support/webTexts.js';

/** The two activities the author puts in the portfolio (main libraries of realWebApp's published examples). */
const CHOSEN = ['H5P.QuestionSet', 'H5P.CoursePresentation'] as const;
const FILE_NAME = /^pedagogisk-mappe-\d{4}-\d{2}-\d{2}\.(md|pdf)$/;

/** Clicks a download button and returns the file the browser saved, with its suggested name. */
async function download(page: Page, button: string): Promise<{ name: string; bytes: Buffer }> {
  const [saved] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: button, exact: true }).click(),
  ]);
  const path = await (saved as Download).path();
  return { name: saved.suggestedFilename(), bytes: await readFile(path) };
}

describeWithRealWebApp('[MAPPE-001] the pedagogisk mappe downloads in a browser', () => {
  let browser: Browser;
  let app: RealWebApp;
  const savedSandbox = process.env.PDF_ALLOW_NO_SANDBOX;
  beforeAll(async () => {
    // WHY: root cannot use Chromium's sandbox; the non-root CI runner keeps it (D-096 contracts amendment).
    process.env.PDF_ALLOW_NO_SANDBOX = String(runsAsRoot);
    browser = await chromium.launch();
    app = await openRealWebApp(browser);
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
    if (savedSandbox === undefined) delete process.env.PDF_ALLOW_NO_SANDBOX;
    else process.env.PDF_ALLOW_NO_SANDBOX = savedSandbox;
  });

  it('[MAPPE-001][MAPPE-004] the author chooses activities, hears the word count and downloads Markdown and PDF; nothing is stored', async () => {
    // Arrange: what the server holds before the export, and the two chosen activities
    const ids = CHOSEN.map((library) => app.ids.get(library) ?? '');
    const rows = await app.tb.db.h5PContent.findMany({ where: { id: { in: ids } }, select: { title: true } });
    const s3 = createS3Client(app.tb.env);
    const buckets = [app.tb.env.S3_CONTENT_BUCKET, app.tb.env.S3_TEMPORARY_BUCKET];
    const stored = async () => ({
      objects: await Promise.all(
        buckets.map(async (Bucket) => (await s3.send(new ListObjectsV2Command({ Bucket }))).KeyCount ?? 0),
      ),
      activities: await app.tb.db.h5PContent.count({ where: { ownerUserId: app.authorId } }),
      audit: await app.tb.db.auditEvent.count({ where: { actorUserId: app.authorId } }),
    });
    const context = await browser.newContext({ storageState: app.authorStorage, acceptDownloads: true });
    const page = await context.newPage();
    const flow = await recordFlow(page, app.base);
    const seen = await flow.run(async () => {
      // Act: choose the two activities on /mappe
      flow.step = 'choose';
      await page.goto(`${app.base}/mappe`);
      for (const id of ids)
        await page.locator(`input[type="checkbox"][id$="-${id}"]`).check({ timeout: 30_000 });
      // Act: the word count is announced
      flow.step = 'word count';
      const counted = page.getByRole('status').filter({
        hasText: new RegExp(
          `${webTextPattern('mappe.wordCountWithin').source}|${webTextPattern('mappe.wordCountOver').source}`,
        ),
      });
      await counted.waitFor({ timeout: 30_000 });
      const wordCount = await counted.textContent();
      const before = await stored();
      // Act: download both files
      flow.step = 'Markdown';
      const markdown = await download(page, webText('mappe.downloadMarkdown'));
      await page.getByText(webText('mappe.downloaded', { file: markdown.name })).waitFor();
      flow.step = 'PDF';
      const pdf = await download(page, webText('mappe.downloadPdf'));
      await page.getByText(webText('mappe.downloaded', { file: pdf.name })).waitFor();
      return { wordCount, before, after: await stored(), markdown, pdf };
    });
    const text = seen.markdown.bytes.toString('utf8');
    const facts = await readTaggedPdf(seen.pdf.bytes);
    // Assert: the word count was said in a status region
    expect(seen.wordCount).toMatch(/\d/);
    // Assert: the Markdown names the chosen activities (escaped as Markdown text, D-094)
    expect([seen.markdown.name, seen.pdf.name].every((name) => FILE_NAME.test(name))).toBe(true);
    expect(seen.markdown.bytes.length).toBeGreaterThan(0);
    expect(rows).toHaveLength(CHOSEN.length);
    for (const { title } of rows) expect(text.replace(/\\/g, '')).toContain(title);
    // Assert: a PDF whose title pdf.js reads is the Markdown's first heading
    expect(seen.pdf.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(facts.title).toEqual(expect.stringMatching(/\S/));
    expect(facts.title).toBe(firstTopHeading(text));
    expect(facts.marked).toBe(true);
    // Assert: made on request and kept nowhere
    expect(seen.after).toEqual(seen.before);
    expect(flow.problems).toEqual([]);
    await context.close();
  }, 180_000);
});
