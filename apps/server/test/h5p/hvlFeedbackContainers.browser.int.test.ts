/**
 * Browser tests of the answer prefixes for the question types the containers offer as sub-content (D-078 libraries):
 * TrueFalse, MarkTheWords and MultiMediaChoice in a QuestionSet, SingleChoiceSet in a Column, and the Summary of the
 * seeded InteractiveVideo. Each correct or incorrect state shows an icon and a text, and the text is in the
 * accessibility tree. The activities are filled with each library's Nynorsk defaults, as the editor does.
 *
 * Spec: UD-003
 */
import { join, resolve } from 'node:path';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import {
  contentTree,
  openRealPlayer,
  openRealTypesServer,
  type RealTypesServer,
} from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';

/** The library folders `npm run h5p:fetch-libraries` writes beside the packages. */
const LIBRARIES_DIR = resolve(REAL_PACKAGES_DIR, '..', 'libraries');
const DEFAULTS_MODULE = new URL('../../../../tools/h5p-libraries/semanticDefaults.mjs', import.meta.url);
const sub = (library: string, id: string, params: object) => ({
  library,
  subContentId: id,
  metadata: { title: library, license: 'U' },
  params,
});
const image = (id: string, alt: string) => sub('H5P.Image 1.1', id, { alt, decorative: false });
// WHY: the editor starts a score-range list with one range; MultiMediaChoice's check needs it.
const ranges = [{ from: 0, to: 100, feedback: 'Les tilbakemeldinga og prøv igjen.' }];

/** Saves a published activity whose parameters are completed with the libraries' Nynorsk defaults. */
async function activity(server: RealTypesServer, library: string, params: object): Promise<string> {
  // WHY: the packer's own defaults (tools/h5p-libraries), so the content is what an HVL author would save.
  const { libraryDefaults, withDefaults } = (await import(DEFAULTS_MODULE.href)) as {
    libraryDefaults: (dir: string) => object;
    withDefaults: (params: object, defaults: (library: string) => object, library: string) => object;
  };
  const defaults = (name: string) => libraryDefaults(join(LIBRARIES_DIR, name.replace(' ', '-')));
  const metadata = { title: library, license: 'U', defaultLanguage: 'nn' };
  const filled = withDefaults(params, defaults, library);
  return server.tb.activity(server.author, { library, params: filled, metadata, published: true });
}

const QUESTIONS = {
  introPage: { showIntroPage: false },
  questions: [
    sub('H5P.TrueFalse 1.8', 'tf', {
      question: '<p>Undervegsvurdering tel med i karakteren.</p>',
      correct: 'false',
    }),
    sub('H5P.MarkTheWords 1.11', 'mtw', {
      taskDescription: '<p>Merk orda som seier når undervegsvurdering skjer og kva ho skal gjere.</p>',
      textField: '<p>Undervegsvurdering skjer *medan* læringa held på og skal *hjelpe* studenten.</p>',
      overallFeedback: ranges,
    }),
    sub('H5P.MultiMediaChoice 0.3', 'mmc', {
      question: '<p>Kva bilete viser ei samling?</p>',
      options: [
        { media: image('mmc-a', 'Ei samling'), correct: true },
        { media: image('mmc-b', 'Eit tomt rom'), correct: false },
      ],
      overallFeedback: ranges,
    }),
  ],
};
const CHOICES = {
  content: [
    {
      content: sub('H5P.SingleChoiceSet 1.11', 'scs', {
        choices: [
          {
            subContentId: 'scs-1',
            question: '<p>Kva er undervegsvurdering?</p>',
            answers: ['<p>Vurdering medan læringa held på</p>', '<p>Eksamen</p>'],
          },
        ],
        behaviour: { autoContinue: false },
      }),
    },
  ],
};

const current = (page: Page) => page.locator('.question-container:visible');
const press = (page: Page, name: RegExp) => current(page).getByRole('button', { name }).click();
const visibleText = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => (el.getBoundingClientRect().width > 0 ? el.textContent : ''));
const before = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el, '::before').content);

describeWithServices('answer prefixes inside containers', () => {
  describeWithRealPackages('[UD-003] the question types the containers offer', () => {
    let server: RealTypesServer;
    const ids: Record<string, string> = {};
    beforeAll(async () => {
      server = await openRealTypesServer();
      ids.questionSet = await activity(server, 'H5P.QuestionSet 1.21', QUESTIONS);
      ids.column = await activity(server, 'H5P.Column 1.18', CHOICES);
    }, 180_000);
    afterAll(() => server?.close());

    describeWithBrowser('[UD-003] in Chromium', (browser) => {
      it('[UD-003] QuestionSet: TrueFalse, MarkTheWords and MultiMediaChoice show and announce their prefixes', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, ids.questionSet ?? '');
        // Act and assert: TrueFalse, "Rett" is wrong; its label is shown beside the library's own ✗ (the radio's
        // name starts with the glyph of TrueFalse's radio icon, its ::before)
        await current(page).locator('.h5p-true-false-answer', { hasText: 'Rett' }).click();
        await press(page, /^Check the answers/);
        await expect.poll(() => contentTree(page)).toMatch(/radio "[^"]{0,2}Feil: Rett/);
        expect(await visibleText(page, '.h5p-true-false-answer.wrong > .hvl-feedback-text')).toBe('Feil: ');
        await press(page, /^Show the solution/);
        await expect.poll(() => contentTree(page)).toMatch(/radio "[^"]{0,2}Riktig: Feil/);
        // MarkTheWords: one right and one wrong word; the solution shows the missed one with the full prefix
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await current(page).getByRole('option', { name: 'medan' }).click();
        await current(page).getByRole('option', { name: 'studenten' }).click();
        await press(page, /^Check the answers/);
        await expect
          .poll(() => contentTree(page))
          .toMatch(/option "Riktig: medan[\s\S]*option "Feil: studenten/);
        expect(await before(page, '[aria-describedby=h5p-description-incorrect]')).toBe('"Feil:" / ""');
        await press(page, /^Show the solution/);
        await expect
          .poll(() => before(page, '[aria-describedby=h5p-description-missed]'))
          .toBe('"✓ Riktig:" / ""');
        // MultiMediaChoice: the option is named by its alt text, which gets the label in front
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await current(page).getByRole('radio', { name: 'Eit tomt rom' }).click();
        await press(page, /^Check the answers/);
        await expect.poll(() => contentTree(page)).toContain('radio "Feil: Eit tomt rom"');
        expect(await visibleText(page, '.h5p-multi-media-choice-wrong > .hvl-feedback-text')).toBe('Feil: ');
        await page.close();
      }, 90_000);

      it('[UD-003] Column: SingleChoiceSet labels the chosen and the revealed alternatives', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, ids.column ?? '');
        const right = page.locator('.h5p-sc-alternative', { hasText: 'Vurdering medan' });
        const height = () => right.evaluate((el) => el.getBoundingClientRect().height);
        const unrevealed = await height();
        // Act
        await page.getByRole('radio', { name: /^Eksamen/ }).click();
        // Assert: the chosen wrong one beside its own ✗, the right one it reveals with icon and text; the label sits
        // inside the answer's paragraph, so SingleChoiceSet's `p:first-child` margin still applies
        const tree = () => page.locator('.h5p-content').ariaSnapshot();
        await expect.poll(tree).toContain('radio "Feil: Eksamen');
        expect(await tree()).toContain('radio "Riktig: Vurdering medan læringa held på');
        expect(await height()).toBe(unrevealed);
        expect(await before(page, '.h5p-sc-drummed .h5p-sc-label > p')).toBe('"Feil:" / ""');
        expect(await before(page, '.h5p-sc-reveal-correct .h5p-sc-label > p')).toBe('"✓ Riktig:" / ""');
        await page.close();
      }, 60_000);

      it("[UD-003] InteractiveVideo: the Summary's wrong and accepted claims show and announce their prefixes", async () => {
        // Arrange: play, jump to the summary at the end of the seeded video and open it
        const page = await openRealPlayer(browser(), server, 'H5P.InteractiveVideo');
        type Video = { H5P: { instances: { seek(t: number): void; pause(): void }[] } };
        await page.locator('.h5p-splash-wrapper').click();
        await page.evaluate(() => (window as unknown as Video).H5P.instances[0]?.seek(5.2));
        await page.locator('.h5p-interaction.h5p-summary-interaction').waitFor();
        await page.evaluate(() => (window as unknown as Video).H5P.instances[0]?.pause());
        await page.locator('.h5p-interaction.h5p-summary-interaction').click();
        const dialog = page.locator('.h5p-dialog');
        // Act
        await dialog.getByRole('radio', { name: /eit anna ord for eksamen/ }).click();
        const wrong = dialog.locator('li.summary-failed');
        await expect
          .poll(() => visibleText(page, 'li.summary-failed > p > .hvl-feedback-text'))
          .toBe('Feil: ');
        await dialog.getByRole('radio', { name: /hjelpe studenten å lære/ }).click();
        // Assert: the library's own name already starts with the state, so it is kept; the accepted claim is read
        // with its prefix in the list of right answers
        expect(await wrong.getAttribute('aria-label')).toBe(
          'Feil. Undervegsvurdering er eit anna ord for eksamen.',
        );
        await expect
          .poll(() => dialog.ariaSnapshot())
          .toMatch(/listitem:[\s\S]*Riktig: Undervegsvurdering skal hjelpe/);
        await page.close();
      }, 60_000);
    });
  });
});
