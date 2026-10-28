/**
 * Probe P3 (S5): what learner state the real content types save, and what a learner meets on resume after an
 * author's edit, played in Chromium (D-093). This file: how H5P stores the state, H5P.ImageHotspots (no state),
 * the "RESET" marker, H5P.MultiChoice and H5P.Blanks. Composite types: ./learnerStateAfterEditComposite.browser.int.test.ts
 * and ./learnerStateAfterEditNavigation.browser.int.test.ts; DragText, BranchingScenario and InteractiveVideo:
 * ./learnerStateAfterEditPaths.browser.int.test.ts.
 *
 * Text-only edits resume correctly (PROD-013 keeps state for them). The `upstream pin:` tests record that the types
 * restore answers by position and never check them against the new structure, so an added, removed or moved option
 * or blank restores a wrong answer, drops the learner's input silently, or stops the activity from starting.
 *
 * Spec: PROD-013, H5P-005
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../../support/browser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { openStateBench, type BenchActivity, type StateBench } from './learnerStateAfterEditBench.js';
import {
  edited,
  plainText,
  replaceText,
  swap,
  type BlanksParams,
  type MultiChoiceParams,
} from './learnerStateAfterEditEdits.js';
import { BLANKS, MULTI_CHOICE } from './learnerStateAfterEditLearners.js';
import { openAsLearner, outcomes, probeEdits, type EditProbe } from './learnerStateAfterEditPlayer.js';

describeWithServices('[PROD-013] learner state after an author’s edit (probe P3)', () => {
  describeWithRealPackages('[PROD-013] the real types, resumed in Chromium', () => {
    let bench: StateBench;
    beforeAll(async () => {
      bench = await openStateBench();
    }, 180_000);
    afterAll(() => bench?.close());

    describeWithBrowser('[PROD-013] state rows, ImageHotspots and the RESET marker', (browser) => {
      let mc: BenchActivity;
      let probe: EditProbe;
      let option: (index: number) => string;
      beforeAll(async () => {
        mc = await bench.importExample('H5P.MultiChoice');
        const answers = (mc.params as unknown as MultiChoiceParams).answers;
        option = (index) => plainText(answers[index]?.text ?? '');
        const edit = (change: (p: MultiChoiceParams) => void) => edited<MultiChoiceParams>(mc.params, change);
        probe = await probeEdits(browser(), bench, mc, MULTI_CHOICE, {
          textOnly: edit((p) => {
            p.question = replaceText(p.question, 'Kva kjenneteiknar', 'Kva er typisk for');
            p.answers[1]!.tipsAndFeedback = { chosenFeedback: '<div>Nei, prøv igjen.</div>' };
          }),
          answerKeyChanged: edit((p) => void (p.answers[2]!.correct = true)),
          shuffledOn: edit((p) => void (p.behaviour.randomAnswers = true)),
          optionAppended: edit((p) => void p.answers.push({ text: '<div>Ny</div>', correct: false })),
          optionPrepended: edit((p) => void p.answers.unshift({ text: '<div>Ny</div>', correct: false })),
          firstOptionRemoved: edit((p) => void p.answers.shift()),
          firstTwoSwapped: edit((p) => swap(p.answers, 0, 1)),
          chosenOptionRemoved: edit((p) => void p.answers.splice(1)),
        });
      }, 180_000);

      it('[PROD-013] H5P saves a learner’s whole state as one main row: sub-content 0, preloaded, invalidated on change', () => {
        expect(probe.rows).toEqual([
          {
            ...{ subContentId: '0', dataType: 'state', contextId: '' },
            ...{ learnerKey: bench.learner.actor.learnerKey, data: '{"answers":[1]}' },
            ...{ preload: true, invalidate: true },
          },
        ]);
      });

      it('[PROD-013] H5P.ImageHotspots saves no learner state, so no edit of it can break a resume', async () => {
        // Arrange
        const hotspots = await bench.importExample('H5P.ImageHotspots');
        const { page, errors } = await openAsLearner(browser(), bench, hotspots.id);
        // Act: open a hotspot and wait past H5P's 5 s autosave
        await page.locator('.h5p-image-hotspot').first().click();
        await page.waitForTimeout(6_500);
        const hasStateFunction = await page.evaluate(
          () =>
            typeof (window as unknown as { H5P: { instances: { getCurrentState?: unknown }[] } }).H5P
              .instances[0]?.getCurrentState,
        );
        await page.close({ runBeforeUnload: false });
        // Assert
        expect({ hasStateFunction, rows: await bench.stateRows(hotspots.id), errors }).toEqual({
          hasStateFunction: 'undefined',
          rows: [],
          errors: [],
        });
      }, 60_000);

      it('[PROD-013] a main row holding "RESET" makes H5P tell the learner the activity changed; OK deletes it', async () => {
        // Arrange: H5P PHP marks invalidated rows this way instead of deleting them
        await bench.restoreRows(mc.id, [{ ...probe.rows[0]!, data: 'RESET' }]);
        // Act
        const { page, errors } = await openAsLearner(browser(), bench, mc.id);
        const dialog = page.locator('.h5p-content-user-data-reset-dialog');
        const told = (await dialog.innerText()).replace(/\s+/g, ' ').trim();
        await dialog.locator('.h5p-dialog-ok-button').click();
        await expect.poll(() => bench.stateRows(mc.id)).toEqual([]);
        await page.close({ runBeforeUnload: false });
        // Assert: Lumi's "nn" client texts are Bokmål (upstream translation)
        expect({ told, errors }).toEqual({
          told: 'Data Reset Dette innholdet har endret seg siden du sist brukte det. Du begynner på nytt. OK',
          errors: [],
        });
      }, 60_000);

      it('[PROD-013] H5P.MultiChoice: text, feedback, answer-key and shuffle edits resume the option the learner chose', () => {
        const chosen = { started: true, selected: [option(1)], errors: [] };
        expect(outcomes(probe, (r) => ({ selected: r.selected }))).toMatchObject({
          ...{ textOnly: chosen, answerKeyChanged: chosen },
          ...{ shuffledOn: chosen, optionAppended: chosen },
        });
      });

      it('upstream pin: H5P.MultiChoice restores options by index, so adding, removing or moving options changes or breaks the answer', () => {
        expect(outcomes(probe, (r) => ({ selected: r.selected }))).toMatchObject({
          optionPrepended: { started: true, selected: [option(0)], errors: [] },
          firstOptionRemoved: { started: true, selected: [option(2)], errors: [] },
          firstTwoSwapped: { started: true, selected: [option(0)], errors: [] },
          chosenOptionRemoved: {
            ...{ started: false, selected: [] },
            errors: ["Cannot read properties of undefined (reading 'weight')"],
          },
        });
      });
    });

    describeWithBrowser('[PROD-013] H5P.Blanks', (browser) => {
      let probe: EditProbe;
      beforeAll(async () => {
        const blanks = await bench.importExample('H5P.Blanks');
        const edit = (change: (p: BlanksParams) => void) => edited<BlanksParams>(blanks.params, change);
        probe = await probeEdits(browser(), bench, blanks, BLANKS, {
          textOnly: edit((p) => {
            p.text = replaceText(p.text, 'Fyll inn', 'Skriv inn');
            p.questions[0] = replaceText(p.questions[0]!, 'Før samlinga', 'Før kvar samling');
          }),
          answerKeyChanged: edit((p) => {
            p.questions[0] = replaceText(p.questions[0]!, '*quiz/test:', '*prøve:');
          }),
          blankAdded: edit((p) => void p.questions.push('<p>Ein ny *setning* her.</p>')),
          lastQuestionRemoved: edit((p) => void p.questions.pop()),
          firstTwoQuestionsSwapped: edit((p) => swap(p.questions, 0, 1)),
        });
      }, 180_000);

      it('[PROD-013] H5P.Blanks saves one string per blank, and text or answer-key edits resume them as typed', () => {
        const typed = ['quiz', 'samtale', '', '', '', '', ''];
        expect(probe.saved).toEqual(typed);
        expect(outcomes(probe, (r) => ({ typed: r.typed }))).toMatchObject({
          ...{ textOnly: { started: true, typed, errors: [] } },
          ...{ answerKeyChanged: { started: true, typed, errors: [] } },
        });
      });

      it('upstream pin: H5P.Blanks drops the input when the number of blanks changes and keeps it by position when questions move', () => {
        expect(outcomes(probe, (r) => ({ typed: r.typed }))).toMatchObject({
          blankAdded: { started: true, typed: Array(8).fill(''), errors: [] },
          lastQuestionRemoved: { started: true, typed: Array(6).fill(''), errors: [] },
          // WHY: "quiz" now sits in the blank whose answer is "samtale", and the other way round.
          firstTwoQuestionsSwapped: {
            started: true,
            typed: ['quiz', 'samtale', '', '', '', '', ''],
            errors: [],
          },
        });
      });
    });
  });
});
