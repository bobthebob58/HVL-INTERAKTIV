/**
 * End-to-end test of publishing despite a validator error in Chromium: a Feide author signs in through the mock Feide
 * from the activity page, finds the error with **Gå til feltet** on **Sjekk og publiser**, is refused without a reason
 * (the error summary links to the reason field), writes one and publishes. The database then holds one
 * ValidationAcknowledgement with the rule, path and reason; the audit and the log hold no reason text. The whole
 * server with the built web app and the real content types (../test/support/realWebApp.ts). A failed step names
 * itself, what failed before it and whether another process removed the author or the draft
 * (../test/support/flowRecorder.ts, ../test/support/lostTestRows.ts).
 *
 * Spec: PROD-003, UD-022, UD-013, AUTH-001, DATA-007
 */
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { recordFlow } from '../test/support/flowRecorder.js';
import { IMAGE_ALT_PATH, saveImageWithoutAltDraft } from '../test/support/imageWithoutAltDraft.js';
import { lostRowsFact } from '../test/support/lostTestRows.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';

const TITLE = 'Fasane i læringsdesignet';
const REASON = 'Biletet blir skildra i teksten under spørsmålet.';
/** The start of V-IMG-ALT's Nynorsk message (apps/server/src/validation/locales/nn.json). */
const ALT_MESSAGE = 'Biletet manglar alternativ tekst.';

/** The element whose `id` is `id` (React's `useId` values need no CSS escaping this way). */
const byId = (page: Page, id: string) => page.locator(`[id="${id}"]`);

describeWithRealWebApp('[PROD-003] publishing despite a validator error, with a reason', () => {
  let browser: Browser;
  let app: RealWebApp;
  let author: string;
  let contentId: string;
  let startedAt: Date;
  beforeAll(async () => {
    startedAt = new Date();
    browser = await chromium.launch();
    app = await openRealWebApp(browser);
    // WHY: realWebApp signed the mock Feide author in and gave them its draft; this flow's draft is theirs too.
    author = (await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: app.draftId } })).ownerUserId;
    contentId = await saveImageWithoutAltDraft(app.tb.runtime.editor, author, TITLE);
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[PROD-003][UD-022] the author signs in, is refused without a reason, gives one and publishes; one acknowledgement is stored', async () => {
    // Arrange: record the flow; a failed step reports the publish requests and whether its rows are still there
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const flow = await recordFlow(page, app.base);
    const publishRequest = `POST /api/content/${contentId}/publish`;
    const publishRequests = () => flow.requests.filter((r) => r === publishRequest).length;
    const facts = async () => ({
      publishRequests: publishRequests(),
      ...(await lostRowsFact(app.tb.db, {
        users: { 'the Feide author': author },
        contents: { 'the draft': contentId },
      })),
    });
    const seen = await flow.run(async () => {
      // Act: sign in through the mock Feide from the activity page
      flow.step = 'sign-in';
      await page.goto(`${app.base}/aktivitet/${contentId}`);
      app.tb.mock.feide.nextLogin('author');
      await page.getByRole('main').getByRole('link', { name: 'Logg inn med Feide' }).click();
      await page.getByRole('heading', { level: 1, name: TITLE }).waitFor({ timeout: 30_000 });
      const returnedTo = new URL(page.url()).pathname;
      // Act: the check tab lists the error with "Gå til feltet"
      flow.step = 'check';
      await page.getByRole('tab', { name: 'Sjekk og publiser' }).click();
      const errors = page.getByRole('region', { name: 'Feil (1)' });
      await errors.waitFor({ timeout: 15_000 });
      const goTo = errors.getByRole('button', { name: 'Gå til feltet' });
      const finding = await byId(page, (await goTo.getAttribute('aria-describedby')) ?? '').textContent();
      const errorItem = await errors.getByRole('listitem').textContent();
      // Act: publish without a reason
      flow.step = 'refusal';
      await page.getByRole('button', { name: 'Publiser', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Publiser aktiviteten' });
      await dialog.getByRole('button', { name: 'Publiser no' }).click();
      const summary = dialog.getByRole('alert').filter({ hasText: 'Det er 1 problem du må rette' });
      await summary.waitFor();
      const summaryHasFocus = await summary.evaluate((element) => element === document.activeElement);
      const link = summary.getByRole('link');
      const fieldId = (await link.getAttribute('href'))?.replace(/^#/, '') ?? '';
      const field = byId(page, fieldId);
      const refusal = {
        link: await link.textContent(),
        invalid: await field.getAttribute('aria-invalid'),
        describedBy: (await field.getAttribute('aria-describedby'))?.split(' '),
        fieldProblem: await byId(page, `${fieldId}-error`).textContent(),
      };
      await link.click();
      const focusAfterLink = await page.evaluate(() => document.activeElement?.id);
      const statusAfterRefusal = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
      const requestsAfterRefusal = publishRequests();
      // Act: write the reason and publish
      flow.step = 'publish';
      await field.fill(REASON);
      const answer = page.waitForResponse(
        (r) => `${r.request().method()} ${new URL(r.url()).pathname}` === publishRequest,
      );
      await dialog.getByRole('button', { name: 'Publiser no' }).click();
      const response = await answer;
      await expect.poll(() => dialog.count(), { timeout: 15_000 }).toBe(0);
      await page.getByRole('status').getByText('Aktiviteten er publisert.', { exact: true }).waitFor();
      const statusLine = page.getByRole('main').locator('p').filter({ hasText: 'Status:' });
      await expect.poll(() => statusLine.textContent()).toBe('Status:✓ Publisert');
      await page.getByText(`Grunngjeve: «${REASON}».`, { exact: false }).waitFor();
      const unpublishOffered = await page.getByRole('button', { name: 'Gjer om til utkast' }).count();
      return {
        returnedTo,
        finding,
        errorItem,
        summaryHasFocus,
        fieldId,
        refusal,
        focusAfterLink,
        statusAfterRefusal,
        requestsAfterRefusal,
        response,
        unpublishOffered,
      };
    }, facts);
    const { returnedTo, finding, errorItem, summaryHasFocus, fieldId, refusal, focusAfterLink } = seen;
    const stored = await app.tb.db.validationAcknowledgement.findMany({ where: { contentId } });
    const row = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
    const audit = await app.tb.db.auditEvent.findMany({ where: { at: { gte: startedAt } } });
    // Assert: signed in and back on the activity, the error with its button
    expect(returnedTo).toBe(`/aktivitet/${contentId}`);
    expect(finding?.startsWith(`✗ Feil: ${ALT_MESSAGE}`)).toBe(true);
    expect(errorItem).toContain('Regel V-IMG-ALT');
    // Assert: refused in the browser, with the summary linked to the reason field
    expect(summaryHasFocus).toBe(true);
    expect(refusal.link?.startsWith(`Skriv ei grunngjeving for feilen «${ALT_MESSAGE}`)).toBe(true);
    expect(refusal.invalid).toBe('true');
    expect(refusal.describedBy).toContain(`${fieldId}-error`);
    expect(refusal.fieldProblem).toContain(refusal.link ?? '');
    expect(focusAfterLink).toBe(fieldId);
    expect(seen.statusAfterRefusal.status).toBe('draft');
    expect(seen.requestsAfterRefusal).toBe(0);
    // Assert: published, with one acknowledgement and no reason text in the audit or the log
    expect(seen.response.status()).toBe(200);
    expect(row.status).toBe('published');
    expect(seen.unpublishOffered).toBe(1);
    expect(stored).toEqual([
      expect.objectContaining({
        ruleId: 'V-IMG-ALT',
        path: IMAGE_ALT_PATH,
        reason: REASON,
        userId: author,
      }),
    ]);
    const published = audit.filter((e) => e.action === 'content.publish' && e.targetId === contentId);
    expect(published).toEqual([
      expect.objectContaining({
        actorUserId: author,
        details: expect.objectContaining({ acknowledgedRuleIds: ['V-IMG-ALT'] }),
      }),
    ]);
    expect(JSON.stringify(audit)).not.toContain(REASON);
    expect(app.tb.logs.join('\n')).not.toContain(REASON);
    expect(pageErrors).toEqual([]);
    await context.close();
  }, 120_000);
});
