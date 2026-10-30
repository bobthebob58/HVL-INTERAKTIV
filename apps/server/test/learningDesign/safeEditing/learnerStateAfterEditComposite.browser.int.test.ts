/**
 * Probe P3 (S5), container types: H5P.Column and H5P.QuestionSet keep each child's state in a list by the child's
 * position and hand entry i to whatever child is at position i after an edit (D-093). Played in Chromium.
 *
 * Text-only edits and appended children resume correctly. The `upstream pin:` tests record that inserting, removing
 * or moving a child gives one question another question's answer, drops answers, or stops the activity from starting
 * (a DragText handed a Blanks answer throws; a shuffled QuestionSet throws on any added or removed question).
 *
 * Spec: PROD-013, H5P-005
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../../support/browser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { openStateBench, type StateBench } from './learnerStateAfterEditBench.js';
import * as edits from './learnerStateAfterEditEdits.js';
import type { ColumnParams, MultiChoiceParams, QuestionSetParams } from './learnerStateAfterEditEdits.js';
import { COLUMN, QUESTION_SET, QUESTION_SET_SHUFFLED } from './learnerStateAfterEditLearners.js';
import { outcomes, probeEdits, type EditProbe } from './learnerStateAfterEditPlayer.js';

const optionsOf = (node: { params: unknown }) =>
  (node.params as MultiChoiceParams).answers.map((answer) => edits.plainText(answer.text));

describeWithServices('[PROD-013] learner state in container types after an edit (probe P3)', () => {
  describeWithRealPackages('[PROD-013] Column and QuestionSet, resumed in Chromium', () => {
    let bench: StateBench;
    beforeAll(async () => {
      bench = await openStateBench();
    }, 180_000);
    afterAll(() => bench?.close());

    describeWithBrowser('[PROD-013] H5P.Column', (browser) => {
      let probe: EditProbe;
      let first: string[];
      let second: string[];
      beforeAll(async () => {
        const example = await bench.importExample('H5P.Column');
        // WHY: a second question with its own option texts shows which question an answer lands in.
        const base = edits.edited<ColumnParams>(example.params, (p) => {
          const copy = edits.copyOfNode(p.content[2]!.content, (params) => {
            const question = params as unknown as MultiChoiceParams;
            question.question = '<p>Kva gjer quizen før samlinga mogleg?</p>';
            question.answers.forEach((answer) => (answer.text = answer.text.replace('<div>', '<div>B: ')));
          });
          p.content.push({ useSeparator: 'auto', content: copy });
        });
        await bench.saveParams(example, base);
        const column = { ...example, params: base as unknown as Record<string, unknown> };
        [first, second] = [optionsOf(base.content[2]!.content), optionsOf(base.content[3]!.content)];
        const edit = (change: (p: ColumnParams) => void) => edits.edited<ColumnParams>(base, change);
        probe = await probeEdits(browser(), bench, column, COLUMN, {
          textOnly: edit((p) => {
            const text = p.content[0]!.content.params as { text: string };
            text.text = edits.replaceText(text.text, 'Tre fasar', 'Tre fasar i emnet');
          }),
          questionAppended: edit(
            (p) =>
              void p.content.push({ ...p.content[2]!, content: edits.copyOfNode(p.content[2]!.content) }),
          ),
          textInsertedFirst: edit(
            (p) =>
              void p.content.unshift({ ...p.content[0]!, content: edits.copyOfNode(p.content[0]!.content) }),
          ),
          questionsSwapped: edit((p) => edits.swap(p.content, 2, 3)),
          firstQuestionRemoved: edit((p) => void p.content.splice(2, 1)),
        });
      }, 180_000);

      it('[PROD-013] H5P.Column saves a list of child states by position; text edits and appended children resume', () => {
        expect(probe.saved).toEqual({ instances: [null, null, { answers: [1] }, { answers: [0] }] });
        expect(outcomes(probe, (r) => ({ selected: r.selected }))).toMatchObject({
          textOnly: { started: true, selected: [first![1], second![0]], errors: [] },
          questionAppended: { started: true, selected: [first![1], second![0]], errors: [] },
        });
      });

      it('upstream pin: H5P.Column hands a child the state of whatever child was at its position before', () => {
        expect(outcomes(probe, (r) => ({ selected: r.selected }))).toMatchObject({
          // WHY: the first question now shows the second question's answer; its own answer is gone.
          textInsertedFirst: { started: true, selected: [first![0]], errors: [] },
          questionsSwapped: { started: true, selected: [second![1], first![0]], errors: [] },
          firstQuestionRemoved: { started: true, selected: [second![1]], errors: [] },
        });
      });
    });

    describeWithBrowser('[PROD-013] H5P.QuestionSet', (browser) => {
      let probe: EditProbe;
      let shuffled: EditProbe;
      let firstOptions: string[];
      let lastOptions: string[];
      beforeAll(async () => {
        const set = await bench.importExample('H5P.QuestionSet');
        const questions = (set.params as unknown as QuestionSetParams).questions;
        [firstOptions, lastOptions] = [optionsOf(questions[0]!), optionsOf(questions[3]!)];
        const edit = (base: object, change: (p: QuestionSetParams) => void) =>
          edits.edited<QuestionSetParams>(base, change);
        probe = await probeEdits(browser(), bench, set, QUESTION_SET, {
          textOnly: edit(set.params, (p) => {
            const first = p.questions[0]!.params as unknown as MultiChoiceParams;
            first.question = edits.replaceText(first.question, 'Studentane tek', 'Alle studentane tek');
          }),
          questionAppended: edit(set.params, (p) => void p.questions.push(edits.copyOfNode(p.questions[0]!))),
          firstAndLastSwapped: edit(set.params, (p) => edits.swap(p.questions, 0, 3)),
          questionPrepended: edit(
            set.params,
            (p) => void p.questions.unshift(edits.copyOfNode(p.questions[3]!)),
          ),
          firstQuestionRemoved: edit(set.params, (p) => void p.questions.shift()),
        });
        const shuffledSet = await bench.importExample('H5P.QuestionSet');
        const base = edit(shuffledSet.params, (p) => void (p.randomQuestions = true));
        await bench.saveParams(shuffledSet, base);
        shuffled = await probeEdits(
          browser(),
          bench,
          { ...shuffledSet, params: base as never },
          QUESTION_SET_SHUFFLED,
          {
            textOnly: edit(
              base,
              (p) => void ((p.questions[0]!.params as unknown as MultiChoiceParams).question = '<p>Ny</p>'),
            ),
            questionAppended: edit(base, (p) => void p.questions.push(edits.copyOfNode(p.questions[0]!))),
            lastQuestionRemoved: edit(base, (p) => void p.questions.pop()),
          },
        );
      }, 240_000);

      it('[PROD-013] H5P.QuestionSet saves progress and child states by position; text edits and appended questions resume', () => {
        // Act and assert: beforeAll saved each edit and resumed the learner; compare what they met
        expect(probe.saved).toEqual({
          progress: 1,
          answers: [{ answers: [1] }, ['quiz', '', ''], [], { answers: [] }],
        });
        expect(outcomes(probe, (r) => ({ selected: r.selected, typed: r.typed }))).toMatchObject({
          textOnly: { started: true, selected: [firstOptions![1]], typed: ['quiz', '', ''], errors: [] },
          questionAppended: {
            started: true,
            selected: [firstOptions![1]],
            typed: ['quiz', '', ''],
            errors: [],
          },
        });
        expect(shuffled.resumed.textOnly).toMatchObject({ started: true, errors: [] });
      });

      it('upstream pin: H5P.QuestionSet gives moved questions other answers, and a type mismatch or a shuffled set crashes', () => {
        // Act and assert: beforeAll saved each edit and resumed the learner; compare what they met
        expect(outcomes(probe, (r) => ({ selected: r.selected, typed: r.typed }))).toMatchObject({
          firstAndLastSwapped: {
            started: true,
            selected: [lastOptions![1]],
            typed: ['quiz', '', ''],
            errors: [],
          },
          questionPrepended: { started: true, selected: [lastOptions![1]], typed: ['', '', ''], errors: [] },
          // WHY: the DragText now at position 2 receives the Blanks answer ["quiz","",""] and throws.
          firstQuestionRemoved: {
            started: false,
            selected: [],
            typed: [],
            errors: ['Stored user state is invalid'],
          },
        });
        const crash = { started: false, errors: ["Cannot read properties of undefined (reading 'library')"] };
        // WHY: the learner's order is random, and questionset.js:214-221 reads questions[order[i]] only for i below
        // the new count, so removing the last question crashes only when the saved order reaches it before its end.
        const order = (shuffled.saved as { readonly order: readonly number[] }).order;
        const removedReachedEarly = order.indexOf(order.length - 1) < order.length - 1;
        expect(shuffled.resumed).toMatchObject({
          questionAppended: crash,
          lastQuestionRemoved: removedReachedEarly ? crash : { started: true, errors: [] },
        });
      });
    });
  });
});
