/**
 * End-to-end test of the repetition suggestion in Chromium (PROD-014, D-152): the signed-in Feide author publishes
 * an *Etterarbeid* draft on its **Sjekk og publiser** tab; the status says the activity is published and where the
 * suggestion is. With a stored time of publishing that is already Saturday in Oslo and still Friday in the
 * browser's own time zone, the block lists the two Saturdays 7 and 21 days on, named in Nynorsk (Chromium has no
 * Nynorsk names of its own). «Lag ein kopi», pressed with the keyboard, makes the copy and opens it on **Rediger**;
 * the database then holds a private draft of the author's with the source and the same phase, and the copy's own
 * **Sjekk og publiser** tab shows no suggestion while it is a draft. The whole server with the built web app and the
 * real content types (../test/support/realWebApp.ts); a failed step names itself (../test/support/flowRecorder.ts).
 *
 * Spec: PROD-014, PROD-003, UD-006
 */
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { recordFlow } from '../test/support/flowRecorder.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { webText } from '../test/support/webAppTexts.js';

/** Late on a Friday evening in UTC: 00:30 on Saturday 28 November in Oslo, 15:30 on Friday in Los Angeles. */
const PUBLISHED_AT = new Date('2026-11-27T23:30:00.000Z');

describeWithRealWebApp(
  '[PROD-014] the repetition suggestion after publishing an Etterarbeid activity',
  () => {
    let browser: Browser;
    let app: RealWebApp;
    beforeAll(async () => {
      browser = await chromium.launch();
      app = await openRealWebApp(browser);
      // Arrange: the author's draft is an Etterarbeid activity
      await app.tb.db.learningDesignMetadata.create({
        data: { contentId: app.draftId, phase: 'etterarbeid' },
      });
    }, 240_000);
    afterAll(async () => {
      await app?.close();
      await browser?.close();
    });

    it('[PROD-014][UD-006] publish, read the two dates, and copy with one press of the keyboard', async () => {
      // Arrange: a browser nine hours behind Oslo, so the days shown can only be Oslo's
      const context = await browser.newContext({
        storageState: app.authorStorage,
        timezoneId: 'America/Los_Angeles',
      });
      const page = await context.newPage();
      const flow = await recordFlow(page, app.base);
      const suggestion = page.getByRole('region', { name: webText('repetition.heading') });
      const publish = page.getByRole('button', { name: webText('publish.open'), exact: true });
      const seen = await flow.run(async () => {
        // Act: publish on the tab, with a reason for any error the validator found
        flow.step = 'publish';
        await page.goto(`${app.base}/aktivitet/${app.draftId}?fane=check`);
        await publish.click({ timeout: 30_000 });
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('button', { name: webText('publish.submit') }).waitFor();
        for (const reason of await dialog.getByRole('textbox').all()) await reason.fill('Formativ øving.');
        await dialog.getByRole('button', { name: webText('publish.submit') }).click();
        const status = page.getByRole('status').filter({ hasText: webText('repetition.published') });
        await status.waitFor();
        await suggestion.waitFor();
        // Act: the same page for a time of publishing whose day differs between Oslo and the browser
        flow.step = 'read the suggestion';
        await app.tb.db.h5PContent.update({
          where: { id: app.draftId },
          data: { publishedAt: PUBLISHED_AT },
        });
        await page.reload();
        await suggestion.waitFor({ timeout: 30_000 });
        const dates = await suggestion
          .locator('li time')
          .evaluateAll((times) => times.map((time) => [time.getAttribute('datetime'), time.textContent]));
        const items = await suggestion.getByRole('listitem').allTextContents();
        // Act: the copy, pressed with the keyboard, and its own tab while it is a draft
        flow.step = 'copy';
        await suggestion.getByRole('button', { name: webText('sharing.duplicate') }).focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(/\/aktivitet\/[0-9a-f-]{36}\?fane=edit$/, { timeout: 60_000 });
        const copyId = new URL(page.url()).pathname.split('/').pop() ?? '';
        flow.step = 'the copy';
        await page.goto(`${app.base}/aktivitet/${copyId}?fane=check`);
        await publish.waitFor({ timeout: 30_000 });
        await page.waitForLoadState('networkidle');
        return { dates, items, copyId, onCopy: await suggestion.count() };
      });
      const copy = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: seen.copyId } });
      const design = await app.tb.db.learningDesignMetadata.findUniqueOrThrow({
        where: { contentId: seen.copyId },
      });
      // Assert: Oslo's Saturday plus 7 and 21 days, with Nynorsk's name of the day
      expect(seen.dates).toEqual([
        ['2026-12-05', 'laurdag 5. desember 2026'],
        ['2026-12-19', 'laurdag 19. desember 2026'],
      ]);
      expect(seen.items[0]).toContain(webText('repetition.after', { days: 7 }));
      expect(seen.items[1]).toContain(webText('repetition.after', { days: 21 }));
      // Assert: the author's private draft of the source, with its phase; a draft shows no suggestion
      expect(copy).toMatchObject({
        ownerUserId: app.authorId,
        status: 'draft',
        visibility: 'private',
        publishedAt: null,
        sourceContentId: app.draftId,
      });
      expect(design.phase).toBe('etterarbeid');
      expect(seen.onCopy).toBe(0);
      expect(flow.problems).toEqual([]);
      await context.close();
    }, 300_000);
  },
);
