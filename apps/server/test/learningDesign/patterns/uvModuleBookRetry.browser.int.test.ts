/**
 * Upstream pin of the book's own «Prøv igjen» in the `uv-module` pattern (Q20; D-115's amendments of 2026-11-04):
 * the pattern is an InteractiveBook 1.15 with a QuestionSet 1.21 check in each of its three chapters, and QuestionSet's
 * reset walks every `.h5p-progress-dot` in the document, not its own, so with several sets on the page it throws.
 * The test creates `uv-module` through the pattern route on the real content types, plays it as its author in
 * Chromium in Nynorsk, finishes the first chapter check (whose results page offers no «Prøv igjen», D-115's default)
 * and presses «Prøv igjen» on the book's summary page. It pins what happens: one `TypeError` (reading `classList`),
 * the book stays on its summary page, and the first check keeps its results, so a finished check cannot be retried.
 * An upstream fix, or a change of the pattern's retry switches, fails the pin, and Q20 and D-115 are looked at again;
 * whether the pattern turns the book's retry off stays the owner's call (Q20).
 *
 * Spec: PROD-009, PED-H07
 */
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../../support/browser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { signInRunAuthor } from '../../support/runFeideAuthor.js';
import { describeWithServices } from '../../support/services.js';
import { openRealPatternBench, type PatternCreationBench } from './patternCreationBench.js';
import { createRealPatterns } from './realPatterns.js';

const QUESTIONS_PER_CHECK = 3;

/** Answers the visible chapter check (each question's first option, right or wrong) and finishes it («Avslutt»). */
async function finishVisibleCheck(page: Page): Promise<void> {
  const set = page.locator('.questionset:visible').first();
  for (let question = 1; question <= QUESTIONS_PER_CHECK; question += 1) {
    await set.locator('.h5p-answer:visible').first().click();
    await set.locator('.h5p-question-check-answer:visible').first().click();
    const onward = question < QUESTIONS_PER_CHECK ? 'Neste' : 'Avslutt';
    await set.getByRole('button', { name: onward, exact: true }).click();
  }
  await page.locator('.questionset-results:visible').first().waitFor();
}

describeWithServices('the uv-module pattern in the player', () => {
  describeWithRealPackages('[PROD-009] uv-module’s book retry on the real content types', () => {
    let bench: PatternCreationBench;
    let contentId = '';
    beforeAll(async () => {
      bench = await openRealPatternBench();
      const [created] = await createRealPatterns(
        bench,
        [{ patternId: 'uv-module', contentType: 'H5P.InteractiveBook', phase: 'underveis' }],
        'nn',
      );
      if (created?.status !== 201) throw new Error(`uv-module was not created: ${created?.status ?? 'none'}`);
      contentId = created.contentId;
    }, 300_000);
    afterAll(() => bench?.close(), 60_000);

    describeWithBrowser('[PROD-009] in Chromium, in Nynorsk', (browser) => {
      it('upstream pin: QuestionSet 1.21 makes uv-module’s book «Prøv igjen» throw, and nothing is reset', async () => {
        // Arrange: the author plays the book; the first chapter check is finished
        const storage = await signInRunAuthor(browser(), bench.tb);
        const context = await browser().newContext({ storageState: storage });
        const page = await context.newPage();
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`));
        await page.goto(`${bench.tb.toolUrl}/h5p/play/${contentId}`);
        await page.waitForSelector('.h5p-content.h5p-initialized', { timeout: 60_000 });
        await page.locator('.questionset:visible').first().waitFor();
        const dotsAtLoad = await page.locator('.h5p-progress-dot').count();
        await finishVisibleCheck(page);
        const results = page.locator('.questionset-results:visible').first();
        // WHY: the results page draws its buttons after it shows; a count before them would always be 0.
        await results.getByRole('button').first().waitFor();
        const setRetries = await results.getByRole('button', { name: 'Prøv igjen' }).count();
        await page.getByRole('button', { name: 'Lag samandrag og send inn' }).first().click();
        await page.waitForFunction(() => location.hash.includes('chapter-summary'));
        const bookRetry = page.getByRole('button', { name: 'Prøv igjen', exact: true });
        // WHY: the hash changes before the summary page is drawn; a pattern without the book's retry fails here.
        await bookRetry.first().waitFor({ timeout: 15_000 });
        const bookRetries = await bookRetry.count();
        const dotsOnSummary = await page.locator('.h5p-progress-dot').count();
        // Act: the book's own «Prøv igjen» on its summary page
        await bookRetry.click();
        await expect.poll(() => pageErrors.length, { timeout: 10_000 }).toBeGreaterThan(0);
        await page.waitForTimeout(1_000);
        const hashAfter = await page.evaluate(() => location.hash);
        await page
          .getByRole('button', { name: /kapittel 1/ })
          .first()
          .click();
        await page.waitForTimeout(500);
        const firstCheck = {
          results: await page.locator('.questionset-results:visible').count(),
          questions: await page.locator('.questionset:visible').count(),
        };
        await context.close();
        // Assert: the setting the fault needs (more than one set's dots in the document: two sets at load, all three
        // on the summary page, as D-115's amendment records) and the pattern's switches
        expect([dotsAtLoad, dotsOnSummary]).toEqual([2 * QUESTIONS_PER_CHECK, 3 * QUESTIONS_PER_CHECK]);
        expect(setRetries).toBe(0);
        expect(bookRetries).toBe(1);
        // Assert: once this fails, QuestionSet's reset no longer throws; look at Q20 and D-115 again
        expect(pageErrors).toEqual([expect.stringMatching(/^TypeError: .*'classList'/)]);
        expect(hashAfter).toContain('chapter-summary');
        expect(firstCheck).toEqual({ results: 1, questions: 0 });
      }, 300_000);
    });
  });
});
