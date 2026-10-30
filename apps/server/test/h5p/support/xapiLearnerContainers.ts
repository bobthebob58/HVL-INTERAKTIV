/**
 * xapiLearnerContainers — what the learner does in CoursePresentation, InteractiveBook, ImageHotspots,
 * BranchingScenario and InteractiveVideo for the xAPI probe test, including a reload of CoursePresentation.
 *
 * Why: probe P1 (D-102) found where these types send their gradable root result, or that they send none, and that a
 *      resumed CoursePresentation re-sends its root result without any learner action; step 3's attempt and
 *      replay rules rest on that, so CoursePresentation is played again after a reload.
 * Spec: H5P-009
 * Invariants:
 *   - Button names are the Nynorsk texts of the package examples (D-078).
 *   - The reload waits until H5P's autosave (every 5 s, D-037) has stored the state, read from the database.
 * Collaborators: ./xapiCapture.ts, ./xapiLearnerQuestions.ts (shared predicates and the script type).
 * Tests: ../xapiContainerTypes.browser.int.test.ts
 */
import { CHECK, rootSent, subSent, waitForAutosave, type LearnerScript } from './xapiLearnerQuestions.js';

/** The scripts of the container and media types, by main library name. */
export const CONTAINER_SCRIPTS: Record<string, LearnerScript> = {
  'H5P.CoursePresentation': {
    actions: [
      'slide2: goes to the slide with the MultiChoice',
      'check: picks the right option and presses «Sjekk»',
      'summary: goes on to the summary slide',
      'reload: waits for the autosave and reloads the page, which resumes on the summary slide',
    ],
    play: async (p, server) => {
      const f = p.frame();
      const slide = f.locator('.h5p-current');
      // UPSTREAM: https://github.com/h5p/h5p-course-presentation/blob/369d140c741fab528604237380c34ec1fe8f121a/src/scripts/cp.js
      // processJumpToSlide sends 'progressed' for a click during the slide animation but does not move, so each
      // click waits until the slide has arrived and stopped moving; needed while CoursePresentation 1.28 does this
      // (no issue filed yet; for D-112's reports).
      const nextSlide = async (index: number) => {
        await f.getByRole('button', { name: 'Neste side' }).click();
        await f.waitForFunction(
          (i) =>
            (
              window as unknown as { H5P: { instances: { getCurrentSlideIndex(): number }[] } }
            ).H5P.instances[0]?.getCurrentSlideIndex() === i &&
            !document.querySelector('.h5p-slide.h5p-animate'),
          index,
        );
      };
      p.step('slide2');
      await nextSlide(1);
      await p.until('the MultiChoice attempted', subSent('attempted'));
      p.step('check');
      await slide.locator('.h5p-answer').nth(0).click();
      await slide.locator(CHECK).first().click();
      await p.until('the MultiChoice answered', subSent('answered'));
      p.step('summary');
      await nextSlide(2);
      await nextSlide(3);
      await p.until('root completed', rootSent(p, 'completed'));
      await p.quiet();
      await waitForAutosave(p, server);
      await p.reload();
      await p.until('root completed again on resume', rootSent(p, 'completed'));
    },
  },
  'H5P.InteractiveBook': {
    actions: [
      'cover: presses «Les» on the cover',
      'check: picks the right option in chapter 1 and presses «Sjekk»',
      'summary: goes to the summary page',
    ],
    play: async (p) => {
      const f = p.frame();
      p.step('cover');
      await f.getByRole('button', { name: 'Les' }).click();
      await p.until('root attempted', rootSent(p, 'attempted'));
      p.step('check');
      await f.locator('.h5p-answer:visible').nth(0).click();
      await f.locator(CHECK).first().click();
      await p.until('the MultiChoice answered', subSent('answered'));
      p.step('summary');
      await f.getByRole('button', { name: 'Neste' }).filter({ visible: true }).first().click();
      await f.locator('.h5p-text-input').filter({ visible: true }).first().waitFor();
      // UPSTREAM: https://github.com/h5p/h5p-interactive-book/blob/90efced9d1fab953e289ac4bc6f751cdd93e0e9c/src/scripts/app.js
      // ignores a chapter change ('newChapter') while the last one still animates; needed while 1.15 does this (no issue
      // filed yet; for D-112's reports).
      await f.waitForFunction(() => !document.querySelector('.h5p-interactive-book-animate'));
      await f
        .getByRole('button', { name: 'Lag samandrag og send inn' })
        .filter({ visible: true })
        .first()
        .click();
      await f.locator('.h5p-interactive-book-summary-progress-container').first().waitFor();
      await p.quiet();
      return { submitButtons: await f.getByRole('button', { name: /Send inn rapport/ }).count() };
    },
  },
  'H5P.ImageHotspots': {
    actions: ['hotspots: opens and closes each of the three hotspots'],
    play: async (p) => {
      const f = p.frame();
      const spots = f.locator('.h5p-image-hotspot');
      let opened = 0;
      p.step('hotspots');
      for (let i = 0; i < (await spots.count()); i++) {
        await spots.nth(i).click();
        // UPSTREAM: https://github.com/h5p/h5p-image-hotspots/blob/adc855f17f2c86e8741c9299f6d834f8fabc7417/scripts/hotspot.js
        // shows a popup with an image only once the image has loaded (readyToPopup); closing it before then throws
        // in that delayed call, so the script waits for `active`; needed while ImageHotspots 1.11 does this
        // (no issue filed yet; for D-112's reports).
        await f.locator('.h5p-image-hotspot.active').waitFor();
        opened += 1;
        await f.locator('.h5p-image-hotspot-close-popup-button').filter({ visible: true }).first().click();
        await f.locator('.h5p-image-hotspot.active').waitFor({ state: 'detached' });
      }
      await p.quiet();
      return { popupsOpened: opened };
    },
  },
  'H5P.BranchingScenario': {
    actions: [
      'start: presses «Start scenarioet» and «Gå vidare»',
      'q1: picks the first alternative and goes on from its feedback and the next text',
      'q2: picks the first alternative, which ends the scenario',
    ],
    play: async (p) => {
      const f = p.frame();
      const proceed = () =>
        f.getByRole('button', { name: 'Gå vidare' }).filter({ visible: true }).first().click();
      p.step('start');
      await f.getByRole('button', { name: 'Start scenarioet' }).click();
      await proceed();
      p.step('q1');
      await f.locator('.h5p-branching-question-alternative').first().click();
      await p.until('the BranchingQuestion interacted', subSent('interacted'));
      await f.getByRole('dialog').getByRole('button', { name: 'Gå vidare' }).click();
      await proceed();
      p.step('q2');
      await f.locator('.h5p-branching-question-alternative').first().click();
      await p.until('root completed', rootSent(p, 'completed'));
    },
  },
  'H5P.InteractiveVideo': {
    actions: [
      'question: plays the video until the MultiChoice button shows at 3 s and opens it',
      'check: picks the right option and presses «Sjekk»',
    ],
    play: async (p) => {
      const f = p.frame();
      p.step('question');
      await f.getByRole('button', { name: 'Spel av (k)' }).first().click();
      await f.getByRole('button', { name: 'Spørsmål om undervegsvurdering' }).click({ timeout: 30_000 });
      await p.until('the MultiChoice attempted', subSent('attempted'));
      p.step('check');
      await f.locator('.h5p-answer:visible').nth(0).click();
      await f.locator(CHECK).first().click();
      await p.until('the MultiChoice answered', subSent('answered'));
    },
  },
};
