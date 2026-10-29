/**
 * Unit tests for the structure signature on the real question types and simple containers (H5P.MultiChoice,
 * H5P.Blanks, H5P.DragText, H5P.Column, H5P.QuestionSet, H5P.ImageHotspots), with probe P3's edit cases on the
 * packages' own examples: text-only edits are not structural, and every edit that adds, removes or moves an option,
 * blank, word or child is, appends included (D-093 errs on the strict side).
 *
 * Spec: PROD-013
 */
import { beforeAll, expect, it } from 'vitest';
import type { PackageExample } from '../../support/realPackages.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import * as edits from './learnerStateAfterEditEdits.js';
import type {
  BlanksParams,
  ColumnParams,
  DragTextParams,
  MultiChoiceParams,
  QuestionSetParams,
} from './learnerStateAfterEditEdits.js';
import { examplesByType, verdicts } from './structuralVerdicts.js';

describeWithRealPackages('[PROD-013] the structure signature on the real question types', () => {
  let examples: ReadonlyMap<string, PackageExample>;
  beforeAll(async () => {
    examples = await examplesByType();
  });
  const example = (machineName: string): PackageExample => {
    const found = examples.get(machineName);
    if (!found) throw new Error(`no real package example of ${machineName}`);
    return found;
  };

  it('[PROD-013] H5P.MultiChoice: rewording, feedback, moving the key and shuffling keep state; options and mode do not', () => {
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<MultiChoiceParams>(example('H5P.MultiChoice'), {
        textOnly: (p) => {
          p.question = edits.replaceText(p.question, 'Kva kjenneteiknar', 'Kva er typisk for');
          p.answers[1]!.tipsAndFeedback = { chosenFeedback: '<div>Nei, prøv igjen.</div>' };
        },
        optionReworded: (p) => void (p.answers[1]!.text = '<div>Ho tel med i karakteren.</div>'),
        answerKeyMoved: (p) => void ([p.answers[0]!.correct, p.answers[1]!.correct] = [false, true]),
        shuffledOn: (p) => void (p.behaviour.randomAnswers = true),
        // WHY: the probe resumed it, but a second correct option turns radio buttons into checkboxes (the mode).
        answerKeyChanged: (p) => void (p.answers[2]!.correct = true),
        optionAppended: (p) => void p.answers.push({ text: '<div>Ny</div>', correct: false }),
        optionPrepended: (p) => void p.answers.unshift({ text: '<div>Ny</div>', correct: false }),
        firstOptionRemoved: (p) => void p.answers.shift(),
        firstTwoSwapped: (p) => edits.swap(p.answers, 0, 1),
        chosenOptionRemoved: (p) => void p.answers.splice(1),
      }),
    ).toEqual({
      ...{ textOnly: false, optionReworded: false, answerKeyMoved: false, shuffledOn: false },
      ...{ answerKeyChanged: true, optionAppended: true, optionPrepended: true },
      ...{ firstOptionRemoved: true, firstTwoSwapped: true, chosenOptionRemoved: true },
    });
  });

  it('[PROD-013] H5P.Blanks: rewording text, tips and a solution keeps state; adding, removing or moving blanks does not', () => {
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<BlanksParams>(example('H5P.Blanks'), {
        textOnly: (p) => {
          p.text = edits.replaceText(p.text, 'Fyll inn', 'Skriv inn');
          p.questions[0] = edits.replaceText(p.questions[0]!, 'Før samlinga', 'Før kvar samling');
        },
        tipReworded: (p) => void (p.questions[0] = edits.replaceText(p.questions[0]!, 'Ei kort', 'Ei lita')),
        answerKeyChanged: (p) =>
          void (p.questions[0] = edits.replaceText(p.questions[0]!, '*quiz/test:', '*prøve:')),
        blankAdded: (p) => void p.questions.push('<p>Ein ny *setning* her.</p>'),
        lastQuestionRemoved: (p) => void p.questions.pop(),
        firstTwoQuestionsSwapped: (p) => edits.swap(p.questions, 0, 1),
      }),
    ).toEqual({
      ...{ textOnly: false, tipReworded: false, answerKeyChanged: false },
      ...{ blankAdded: true, lastQuestionRemoved: true, firstTwoQuestionsSwapped: true },
    });
  });

  it('[PROD-013] H5P.DragText: rewording text and tips keeps state; any change to the words or their order does not', () => {
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<DragTextParams>(example('H5P.DragText'), {
        textOnly: (p) =>
          void (p.textField = edits.replaceText(p.textField, 'handlar om', 'handlar mellom anna om')),
        tipReworded: (p) =>
          void (p.textField = edits.replaceText(p.textField, 'Kva studentane gjer', 'Det studentane gjer')),
        distractorAdded: (p) => void (p.distractors = `${p.distractors} *eksamen*`),
        zoneAppended: (p) => void (p.textField = `${p.textField}\nEin ny *setning* til slutt.`),
        firstLinesSwapped: (p) => edits.editLines(p, (list) => edits.swap(list, 0, 1)),
        lastZoneRemoved: (p) => edits.editLines(p, (list) => void list.pop()),
      }),
    ).toEqual({
      ...{ textOnly: false, tipReworded: false, distractorAdded: true },
      ...{ zoneAppended: true, firstLinesSwapped: true, lastZoneRemoved: true },
    });
  });

  it('[PROD-013] H5P.Column: rewording a text block keeps state; adding, inserting, moving or removing a child does not', () => {
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<ColumnParams>(example('H5P.Column'), {
        textOnly: (p) => {
          const text = p.content[0]!.content.params as { text: string };
          text.text = edits.replaceText(text.text, 'Tre fasar', 'Tre fasar i emnet');
        },
        questionAppended: (p) =>
          void p.content.push({ ...p.content[2]!, content: edits.copyOfNode(p.content[2]!.content) }),
        textInsertedFirst: (p) =>
          void p.content.unshift({ ...p.content[0]!, content: edits.copyOfNode(p.content[0]!.content) }),
        imageAndQuestionSwapped: (p) => edits.swap(p.content, 1, 2),
        questionRemoved: (p) => void p.content.splice(2, 1),
      }),
    ).toEqual({
      ...{ textOnly: false, questionAppended: true, textInsertedFirst: true },
      ...{ imageAndQuestionSwapped: true, questionRemoved: true },
    });
  });

  it('[PROD-013] H5P.QuestionSet: rewording a question and shuffling keep state; questions and the pool size do not', () => {
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<QuestionSetParams>(example('H5P.QuestionSet'), {
        textOnly: (p) => {
          const first = p.questions[0]!.params as unknown as MultiChoiceParams;
          first.question = edits.replaceText(first.question, 'Studentane tek', 'Alle studentane tek');
        },
        shuffledOn: (p) => void (p.randomQuestions = true),
        questionAppended: (p) => void p.questions.push(edits.copyOfNode(p.questions[0]!)),
        firstAndLastSwapped: (p) => edits.swap(p.questions, 0, 3),
        firstQuestionRemoved: (p) => void p.questions.shift(),
        poolOfTwo: (p) => void (p.poolSize = 2),
      }),
    ).toEqual({
      ...{ textOnly: false, shuffledOn: false, questionAppended: true },
      ...{ firstAndLastSwapped: true, firstQuestionRemoved: true, poolOfTwo: true },
    });
  });

  it('[PROD-013] H5P.ImageHotspots keeps no state: rewording a hotspot is not structural, a new hotspot is', () => {
    type Hotspots = { hotspots: { content: edits.SubContent<{ text: string }>[] }[] };
    // Act and assert: each edit of the example, judged by the signature
    expect(
      verdicts<Hotspots>(example('H5P.ImageHotspots'), {
        textOnly: (p) => void (p.hotspots[0]!.content[0]!.params.text = '<p>Ny tekst.</p>'),
        hotspotAdded: (p) =>
          void p.hotspots.push({
            ...p.hotspots[0]!,
            content: [edits.copyOfNode(p.hotspots[0]!.content[0]!)],
          }),
      }),
    ).toEqual({ textOnly: false, hotspotAdded: true });
  });
});
