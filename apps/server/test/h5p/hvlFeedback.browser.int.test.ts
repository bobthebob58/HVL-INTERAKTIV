/**
 * Browser tests of the answer prefixes with the real content types (D-078): a correct or incorrect answer in
 * MultiChoice, Blanks, DragText and QuestionSet shows an icon and a text prefix, and the prefix is in the
 * accessibility tree once, in the page's language; it goes away on retry.
 *
 * Spec: UD-003, UD-010
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { describeWithRealPackages, packageExamples } from '../support/realPackages.js';
import {
  checkAnswers,
  contentTree,
  openRealPlayer,
  openRealTypesServer,
  type RealTypesServer,
} from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('answer prefixes inside H5P', () => {
  describeWithRealPackages('[UD-003] the real question types', () => {
    let server: RealTypesServer;
    beforeAll(async () => {
      server = await openRealTypesServer();
    }, 180_000);
    afterAll(() => server?.close());

    describeWithBrowser('[UD-003] in Chromium', (browser) => {
      it('[UD-003] MultiChoice: a wrong and then a right answer carry their prefix in the accessibility tree', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, 'H5P.MultiChoice');
        // Act and assert: answer 1 is wrong, answer 0 right (the example's content.json)
        await page.locator('.h5p-answer').nth(1).click();
        await checkAnswers(page);
        await expect.poll(() => contentTree(page)).toContain('Feil: Ho tel med i den endelege karakteren');
        const visible = await page
          .locator('.h5p-answer.h5p-wrong .h5p-alternative-inner')
          .evaluate((el) => getComputedStyle(el, '::before').content);
        expect(visible).toBe('"Feil:" / ""');
        await page.locator('.h5p-question-try-again').click();
        await expect.poll(() => page.locator('.hvl-feedback-sr').count()).toBe(0);
        await page.locator('.h5p-answer').nth(0).click();
        await checkAnswers(page);
        await expect.poll(() => contentTree(page)).toContain('Riktig: Ho gir studenten tilbakemelding');
        await page.close();
      }, 60_000);

      it('[UD-003] Blanks: a right and a wrong field carry their prefix in the accessibility tree', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, 'H5P.Blanks');
        // Act
        await page.locator('.h5p-text-input').nth(0).fill('quiz');
        await page.locator('.h5p-text-input').nth(1).fill('zzz');
        await checkAnswers(page);
        // Assert
        await expect.poll(() => contentTree(page)).toMatch(/ein Riktig:[\s\S]*bruker vi tida på Feil:/);
        await page.close();
      }, 60_000);

      it('[UD-003] DragText: a right and a wrong word carry their prefix, also in the explanations', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, 'H5P.DragText');
        const zones = page.locator('.h5p-drag-text [aria-dropeffect]');
        // Act: drop with the keyboard (the single-pointer alternative, UD-005)
        for (const [word, zone] of [
          ['læringsaktivitetar', 0],
          ['sluttvurdering', 1],
        ] as const) {
          await page.locator('.h5p-drag-text .h5p-draggable', { hasText: word }).focus();
          await page.keyboard.press('Space');
          await zones.nth(zone).focus();
          await page.keyboard.press('Space');
        }
        await checkAnswers(page);
        // Assert
        const snapshot = await contentTree(page);
        expect(snapshot).toContain('button "Riktig: læringsaktivitetar');
        expect(snapshot).toContain('button "Feil: sluttvurdering');
        expect(snapshot).toMatch(/listitem: "Riktig: samlinga Feil: sluttvurdering/);
        await page.close();
      }, 60_000);

      it('[UD-003] QuestionSet: an answer inside the set carries its prefix', async () => {
        const page = await openRealPlayer(browser(), server, 'H5P.QuestionSet');
        await page.locator('.h5p-theme-primary-cta').first().click();
        await page.locator('.question-container:visible .h5p-answer').first().click();
        await checkAnswers(page);
        await expect.poll(() => contentTree(page)).toContain('Riktig: Å vise studentane og læraren');
        await page.close();
      }, 60_000);

      it('[UD-010] the prefix follows the language: an English activity for an English learner', async () => {
        // Arrange: the example in English, so the result holds whether `lang` comes from the page or the container
        const example = (await packageExamples()).find((e) => e.library.startsWith('H5P.MultiChoice'));
        if (!example) throw new Error('no MultiChoice example');
        const metadata = { ...example.metadata, defaultLanguage: 'en' };
        const params = { library: example.library, params: example.params, metadata, published: true };
        const id = await server.tb.activity(server.author, params);
        const english = await server.tb.actor('learner', { locale: 'en' });
        // Act
        const page = await openRealPlayer(browser(), server, id, english);
        await page.locator('.h5p-answer').nth(1).click();
        await checkAnswers(page);
        // Assert
        await expect.poll(() => contentTree(page)).toContain('Incorrect: Ho tel med');
        await page.close();
      }, 60_000);
    });
  });
});
