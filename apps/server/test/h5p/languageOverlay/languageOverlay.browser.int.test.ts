/**
 * Browser tests of HVL's language overlay on the real content types (D-078, D-111): a MultiChoice and a QuestionSet
 * created in Nynorsk as the editor creates them (every text at its default, from the editor's library manager) show
 * the learner Norwegian buttons and results in the real player, where H5P's own nn files left them in English; and
 * the real editor in Bokmål shows the overlay's labels.
 *
 * Spec: H5P-008
 */
import type { Browser, Frame, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { withSemanticDefaults, type Params } from '../../../src/learningDesign/patterns/semanticDefaults.js';
import { describeWithBrowser } from '../../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';

const MULTI_CHOICE = 'H5P.MultiChoice 1.16';
const QUESTION_SET = 'H5P.QuestionSet 1.21';
const question = (id: string, text: string) => ({
  library: MULTI_CHOICE,
  subContentId: id,
  metadata: { title: text, license: 'U' },
  params: {
    question: `<p>${text}</p>`,
    answers: [
      { text: '<div>Medan læringa held på</div>', correct: true },
      { text: '<div>Etter eksamen</div>', correct: false },
    ],
  },
});
const CHOICE = question('mc', 'Når skjer undervegsvurdering?').params;
const QUESTIONS = {
  introPage: { showIntroPage: false },
  questions: [question('q1', 'Spørsmål 1'), question('q2', 'Spørsmål 2')],
};

/** Opens a player page as `actor` and waits until H5P has started the activity. */
async function openPlayer(browser: Browser, base: string, actor: TestActor, id: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.setExtraHTTPHeaders({ [actor.header[0]]: actor.header[1] });
  await page.goto(`${base}/h5p/play/${id}`);
  await page.waitForFunction(() => (window as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length);
  return page;
}

describeWithServices('HVL language overlay in the real player and editor', () => {
  describeWithRealPackages('[H5P-008] activities created in Nynorsk and Bokmål', () => {
    let tb: HttpTestbed;
    let author: TestActor;
    let learner: TestActor;
    let bokmaalAuthor: TestActor;
    let base: string;
    const ids: Record<string, string> = {};
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      bokmaalAuthor = await tb.actor('author', { locale: 'nb' });
      // WHY: a learner whose page records results (the xAPI bridge's CSRF token, D-102), as a learner in the portal.
      learner = await tb.actor('learner', {
        urlToken: { name: 'csrf', value: 'csrf-token-of-the-test-session' },
      });
      // WHY: as the editor and the pattern creator fill a new activity: the defaults of the library's language file.
      const create = async (who: TestActor, library: string, params: Params, language: 'nn' | 'nb') =>
        tb.activity(who, {
          library,
          params: await withSemanticDefaults(params, library, tb.runtime.editor.libraryManager, language),
          metadata: { title: library, license: 'U', defaultLanguage: language },
          published: true,
        });
      ids.multiChoice = await create(author, MULTI_CHOICE, CHOICE, 'nn');
      ids.questionSet = await create(author, QUESTION_SET, QUESTIONS, 'nn');
      ids.bokmaal = await create(bokmaalAuthor, MULTI_CHOICE, CHOICE, 'nb');
      base = await listenOnLoopback(tb.app);
    }, 180_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    }, 60_000);

    describeWithBrowser('[H5P-008] in Chromium', (browser) => {
      it('[H5P-008] a MultiChoice made in Nynorsk names its buttons in Nynorsk for assistive technology and stores «Send inn»', async () => {
        // Arrange
        const page = await openPlayer(browser(), base, learner, ids.multiChoice ?? '');
        const check = page.locator('.h5p-question-check-answer');
        // Act
        const before = [await check.innerText(), await check.getAttribute('aria-label')];
        await page
          .getByRole('checkbox', { name: /Etter eksamen/ })
          .or(page.getByRole('radio', { name: /Etter eksamen/ }))
          .click();
        await check.click();
        // Assert: «Sjekk» is H5P's own Nynorsk; its name for assistive technology is the overlay's (nn.json: English)
        expect(before).toEqual(['Sjekk', 'Sjekk svara. Svara blir merkte som rette, feil eller utan svar.']);
        await expect
          .poll(() => page.locator('.h5p-question-try-again').getAttribute('aria-label'))
          .toBe('Prøv igjen. Alle svara blir nullstilte, og oppgåva startar på nytt.');
        expect(await page.locator('.h5p-question-show-solution').getAttribute('aria-label')).toBe(
          'Vis svar. Oppgåva blir merkt med rette svar.',
        );
        expect(await page.locator('.h5p-content').innerText()).not.toMatch(
          /\b(Submit|Retry|Check the answers)\b/,
        );
        // WHY: the submit text shows only where a platform marks the content as submitted for scoring (H5P.Question).
        const stored = await tb.runtime.editor.getContent(ids.multiChoice ?? '', asAccountUser(author.actor));
        expect((stored.params.params as { UI: Record<string, string> }).UI.submitAnswerButton).toBe(
          'Send inn',
        );
        await page.close();
      }, 90_000);

      it('[H5P-008] a QuestionSet made in Nynorsk shows the learner «Neste» and a Nynorsk results page', async () => {
        // Arrange
        const page = await openPlayer(browser(), base, learner, ids.questionSet ?? '');
        const visible = page.locator('.question-container:visible');
        // Act
        const next = page.getByRole('button', { name: 'Neste', exact: true });
        await expect.poll(() => next.isVisible()).toBe(true);
        await visible.getByText('Medan læringa held på').click();
        await next.click();
        await visible.getByText('Etter eksamen').click();
        await page
          .locator('.h5p-question-finish-button:visible, .h5p-theme-finish:visible, button:visible', {
            hasText: /^(Send inn|Avslutt)$/,
          })
          .first()
          .click();
        // Assert
        const results = page.locator('.questionset-results');
        await expect.poll(() => results.isVisible()).toBe(true);
        const text = await results.innerText();
        expect(text).toContain('Resultat');
        expect(text).toMatch(/1\s*av\s*2\s*rette/);
        expect(text).toContain('Poeng');
        expect(text).not.toMatch(/\b(Results|correct|Score)\b/);
        await page.close();
      }, 90_000);

      it('[H5P-008] the editor in Bokmål shows the overlay’s labels on an activity in Bokmål', async () => {
        // Arrange
        const page = await browser().newPage({ viewport: { width: 1280, height: 900 } });
        await page.setExtraHTTPHeaders({ [bokmaalAuthor.header[0]]: bokmaalAuthor.header[1] });
        // Act
        await page.goto(`${base}/h5p/edit/${ids.bokmaal ?? ''}`);
        await page.frameLocator('iframe.h5p-editor-iframe').locator('.h5peditor-form').first().waitFor();
        const editor =
          page
            .frames()
            .find(
              (frame) =>
                frame.url().includes('/h5p/') &&
                frame !== page.mainFrame() &&
                frame.parentFrame() !== page.mainFrame(),
            ) ?? page.frames().at(-1);
        const labels = await (editor as Frame).evaluate(() =>
          Array.from(document.querySelectorAll('.h5peditor-label')).map((label) => label.textContent?.trim()),
        );
        // Assert
        expect(labels).toContain('Navn på «Send inn»-knappen');
        expect(labels).toContain('Beskrivelse av «Sjekk»-knappen for assisterende teknologi');
        expect(labels).not.toContain('Submit answer button label');
        await page.close();
      }, 90_000);
    });
  });
});
